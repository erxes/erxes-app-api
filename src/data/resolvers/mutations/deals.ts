import * as _ from 'underscore';
import { ActivityLogs, Checklists, Conformities, Deals, Stages } from '../../../db/models';
import { getCompanies, getCustomers, getNewOrder } from '../../../db/models/boardUtils';
import { BOARD_STATUSES, NOTIFICATION_TYPES } from '../../../db/models/definitions/constants';
import { IDeal } from '../../../db/models/definitions/deals';
import { graphqlPubsub } from '../../../pubsub';
import { MODULE_NAMES } from '../../constants';
import { putCreateLog, putDeleteLog, putUpdateLog } from '../../logUtils';
import { checkPermission } from '../../permissions/wrappers';
import { IContext } from '../../types';
import { checkUserIds } from '../../utils';
import {
  copyChecklists,
  copyPipelineLabels,
  createConformity,
  IBoardNotificationParams,
  itemsChange,
  prepareBoardItemDoc,
  sendNotifications,
} from '../boardUtils';

interface IDealsEdit extends IDeal {
  _id: string;
}

const dealMutations = {
  /**
   * Creates a new deal
   */
  async dealsAdd(_root, doc: IDeal & { proccessId: string; aboveItemId: string }, { user, docModifier }: IContext) {
    doc.initialStageId = doc.stageId;
    doc.watchedUserIds = [user._id];

    const extendedDoc = {
      ...docModifier(doc),
      modifiedBy: user._id,
      userId: user._id,
      order: await getNewOrder({ collection: Deals, stageId: doc.stageId, aboveItemId: doc.aboveItemId }),
    };

    const deal = await Deals.createDeal(extendedDoc);

    await sendNotifications({
      item: deal,
      user,
      type: NOTIFICATION_TYPES.DEAL_ADD,
      action: 'invited you to the deal',
      content: `'${deal.name}'.`,
      contentType: MODULE_NAMES.DEAL,
    });

    await putCreateLog(
      {
        type: MODULE_NAMES.DEAL,
        newData: extendedDoc,
        object: deal,
      },
      user,
    );

    const stage = await Stages.getStage(deal.stageId);

    graphqlPubsub.publish('pipelinesChanged', {
      pipelinesChanged: {
        _id: stage.pipelineId,
        proccessId: doc.proccessId,
        action: 'itemAdd',
        data: {
          item: deal,
          aboveItemId: doc.aboveItemId,
          destinationStageId: stage._id,
        },
      },
    });

    return deal;
  },

  /**
   * Edits a deal
   */
  async dealsEdit(_root, { _id, proccessId, ...doc }: IDealsEdit & { proccessId: string }, { user }: IContext) {
    const oldDeal = await Deals.getDeal(_id);
    let checkedAssignUserIds: { addedUserIds?: string[]; removedUserIds?: string[] } = {};

    if (doc.assignedUserIds) {
      const { addedUserIds, removedUserIds } = checkUserIds(oldDeal.assignedUserIds, doc.assignedUserIds);
      const oldAssignedUserPdata = (oldDeal.productsData || [])
        .filter(pdata => pdata.assignUserId)
        .map(pdata => pdata.assignUserId || '');
      const cantRemoveUserIds = removedUserIds.filter(userId => oldAssignedUserPdata.includes(userId));

      if (cantRemoveUserIds.length > 0) {
        throw new Error('Cannot remove the team member, it is assigned in the product / service section');
      }

      checkedAssignUserIds = { addedUserIds, removedUserIds };
    }

    if (doc.productsData) {
      const assignedUsersPdata = doc.productsData
        .filter(pdata => pdata.assignUserId)
        .map(pdata => pdata.assignUserId || '');
      const oldAssignedUserPdata = (oldDeal.productsData || [])
        .filter(pdata => pdata.assignUserId)
        .map(pdata => pdata.assignUserId || '');
      const { addedUserIds, removedUserIds } = checkUserIds(oldAssignedUserPdata, assignedUsersPdata);

      if (addedUserIds.length > 0 || removedUserIds.length > 0) {
        let assignedUserIds = doc.assignedUserIds || oldDeal.assignedUserIds || [];
        assignedUserIds = [...new Set(assignedUserIds.concat(addedUserIds))];
        assignedUserIds = assignedUserIds.filter(userId => !removedUserIds.includes(userId));
        doc.assignedUserIds = assignedUserIds;

        checkedAssignUserIds = checkUserIds(oldDeal.assignedUserIds, assignedUserIds);
      }
    }

    const extendedDoc = {
      ...doc,
      modifiedAt: new Date(),
      modifiedBy: user._id,
    };

    const updatedDeal = await Deals.updateDeal(_id, extendedDoc);

    await copyPipelineLabels({ item: oldDeal, doc, user });

    const notificationDoc: IBoardNotificationParams = {
      item: updatedDeal,
      user,
      type: NOTIFICATION_TYPES.DEAL_EDIT,
      action: `has updated deal`,
      content: `${updatedDeal.name}`,
      contentType: MODULE_NAMES.DEAL,
    };

    const stage = await Stages.getStage(updatedDeal.stageId);

    if (doc.status && oldDeal.status && oldDeal.status !== doc.status) {
      const activityAction = doc.status === 'active' ? 'activated' : 'archived';

      await ActivityLogs.createArchiveLog({
        item: updatedDeal,
        contentType: 'deal',
        action: activityAction,
        userId: user._id,
      });

      // order notification
      let publishAction = 'itemRemove';
      let publishData = {
        item: updatedDeal,
        aboveItemId: '',
        destinationStageId: '',
        oldStageId: stage._id
      };

      if (activityAction === 'activated'){
        publishAction = 'itemAdd';

        const aboveItems = await Deals.find({
          stageId: updatedDeal.stageId,
          status: { $ne: BOARD_STATUSES.ARCHIVED },
          order: { $lt: updatedDeal.order } }
        ).sort({ order: -1 }).limit(1)

        const aboveItemId = aboveItems[0]?._id || '';

        // maybe, recovered order includes to oldOrders
        await Deals.updateOne({
          _id: updatedDeal._id
        }, {
          order: await getNewOrder({
            collection: Deals, stageId: updatedDeal.stageId, aboveItemId
          })
        });

        publishData = {
          item: updatedDeal,
          aboveItemId,
          destinationStageId: updatedDeal.stageId,
          oldStageId: ''
        };
      }

      graphqlPubsub.publish('pipelinesChanged', {
        pipelinesChanged: {
          _id: stage.pipelineId,
          proccessId,
          action: publishAction,
          data: publishData,
        },
      });
    }

    if (Object.keys(checkedAssignUserIds).length > 0) {
      const { addedUserIds, removedUserIds } = checkedAssignUserIds;

      const activityContent = { addedUserIds, removedUserIds };

      await ActivityLogs.createAssigneLog({
        contentId: _id,
        userId: user._id,
        contentType: 'deal',
        content: activityContent,
      });

      notificationDoc.invitedUsers = addedUserIds;
      notificationDoc.removedUsers = removedUserIds;
    }

    await sendNotifications(notificationDoc);

    await putUpdateLog(
      {
        type: MODULE_NAMES.DEAL,
        object: oldDeal,
        newData: extendedDoc,
        updatedDocument: updatedDeal,
      },
      user,
    );

    // if deal moves between stages
    const { content, action } = await itemsChange(user._id, oldDeal, MODULE_NAMES.DEAL, updatedDeal.stageId);

    await sendNotifications({
      item: updatedDeal,
      user,
      type: NOTIFICATION_TYPES.DEAL_CHANGE,
      content,
      action,
      contentType: MODULE_NAMES.DEAL,
    });

    graphqlPubsub.publish('pipelinesChanged', {
      pipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: 'itemUpdate',
        data: {
          item: updatedDeal,
        },
      },
    });

    return updatedDeal;
  },

  /**
   * Change deal
   */
  async dealsChange(_root, { proccessId, itemId, aboveItemId, destinationStageId, sourceStageId }, { user }: IContext) {
    const deal = await Deals.getDeal(itemId);

    const extendedDoc = {
      modifiedAt: new Date(),
      modifiedBy: user._id,
      stageId: destinationStageId,
      order: await getNewOrder({ collection: Deals, stageId: destinationStageId, aboveItemId }),
    };

    const updatedDeal = await Deals.updateDeal(itemId, extendedDoc);

    const { content, action } = await itemsChange(user._id, deal, MODULE_NAMES.DEAL, destinationStageId);

    await sendNotifications({
      item: deal,
      user,
      type: NOTIFICATION_TYPES.DEAL_CHANGE,
      content,
      action,
      contentType: MODULE_NAMES.DEAL,
    });

    await putUpdateLog(
      {
        type: MODULE_NAMES.DEAL,
        object: deal,
        newData: extendedDoc,
        updatedDocument: updatedDeal,
      },
      user,
    );

    // order notification
    const stage = await Stages.getStage(deal.stageId);

    graphqlPubsub.publish('pipelinesChanged', {
      pipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: 'orderUpdated',
        data: {
          item: deal,
          aboveItemId,
          destinationStageId,
          oldStageId: sourceStageId,
        },
      },
    });

    return deal;
  },

  /**
   * Remove deal
   */
  async dealsRemove(_root, { _id }: { _id: string }, { user }: IContext) {
    const deal = await Deals.getDeal(_id);

    await sendNotifications({
      item: deal,
      user,
      type: NOTIFICATION_TYPES.DEAL_DELETE,
      action: `deleted deal:`,
      content: `'${deal.name}'`,
      contentType: MODULE_NAMES.DEAL,
    });

    await Conformities.removeConformity({ mainType: MODULE_NAMES.DEAL, mainTypeId: deal._id });
    await Checklists.removeChecklists(MODULE_NAMES.DEAL, deal._id);
    await ActivityLogs.removeActivityLog(deal._id);

    const removed = await deal.remove();

    await putDeleteLog({ type: MODULE_NAMES.DEAL, object: deal }, user);

    return removed;
  },

  /**
   * Watch deal
   */
  async dealsWatch(_root, { _id, isAdd }: { _id: string; isAdd: boolean }, { user }: IContext) {
    return Deals.watchDeal(_id, isAdd, user._id);
  },

  async dealsCopy(_root, { _id, proccessId }: { _id: string; proccessId: string }, { user }: IContext) {
    const deal = await Deals.getDeal(_id);

    const doc = await prepareBoardItemDoc(_id, 'deal', user._id);

    doc.productsData = deal.productsData;
    doc.paymentsData = deal.paymentsData;

    const clone = await Deals.createDeal(doc);

    const companies = await getCompanies('deal', _id);
    const customers = await getCustomers('deal', _id);

    await createConformity({
      mainType: 'deal',
      mainTypeId: clone._id,
      customerIds: customers.map(c => c._id),
      companyIds: companies.map(c => c._id),
    });

    await copyChecklists({
      contentType: 'deal',
      contentTypeId: deal._id,
      targetContentId: clone._id,
      user,
    });

    const stage = await Stages.getStage(clone.stageId);

    graphqlPubsub.publish('pipelinesChanged', {
      pipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: 'itemAdd',
        data: {
          item: clone,
          aboveItemId: _id,
          destinationStageId: stage._id,
        },
      },
    });

    return clone;
  },

  async dealsArchive(_root, { stageId }: { stageId: string }, { user }: IContext) {
    const updatedDeal = await Deals.updateMany({ stageId }, { $set: { status: BOARD_STATUSES.ARCHIVED } });

    await ActivityLogs.createArchiveLog({
      item: updatedDeal,
      contentType: 'deal',
      action: 'archived',
      userId: user._id,
    });

    return 'ok';
  },
};

checkPermission(dealMutations, 'dealsAdd', 'dealsAdd');
checkPermission(dealMutations, 'dealsEdit', 'dealsEdit');
checkPermission(dealMutations, 'dealsRemove', 'dealsRemove');
checkPermission(dealMutations, 'dealsWatch', 'dealsWatch');
checkPermission(dealMutations, 'dealsArchive', 'dealsArchive');

export default dealMutations;
