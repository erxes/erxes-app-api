import { Pipelines, Stages } from '../../../db/models';
import { IDealDocument } from '../../../db/models/definitions/deals';
import { ITicketDocument } from '../../../db/models/definitions/tickets';
import { IUserDocument } from '../../../db/models/definitions/users';
import { NOTIFICATION_TYPES } from '../../constants';
import utils from '../../utils';

/**
 * Send notification to all members of this content except the sender
 */
export const sendNotifications = async (
  stageId: string,
  user: IUserDocument,
  type: string,
  assignedUsers: string[],
  content: string,
  contentType: string,
) => {
  const stage = await Stages.findOne({ _id: stageId });

  if (!stage) {
    throw new Error('Stage not found');
  }

  const pipeline = await Pipelines.findOne({ _id: stage.pipelineId });

  if (!pipeline) {
    throw new Error('Pipeline not found');
  }

  return utils.sendNotification({
    createdUser: user._id,
    notifType: type,
    title: content,
    content,
    link: `/${contentType}/board?id=${pipeline.boardId}&pipelineId=${pipeline._id}`,

    // exclude current user
    receivers: (assignedUsers || []).filter(id => id !== user._id),
  });
};

export const manageNotifications = async (
  collection: any,
  item: IDealDocument | ITicketDocument,
  user: IUserDocument,
  type: string,
) => {
  const { _id } = item;
  const oldItem = await collection.findOne({ _id });
  const oldAssignedUserIds = oldItem ? oldItem.assignedUserIds || [] : [];
  const assignedUserIds = item.assignedUserIds || [];

  // new assignee users
  const newUserIds = assignedUserIds.filter(userId => oldAssignedUserIds.indexOf(userId) < 0);

  if (newUserIds.length > 0) {
    await sendNotifications(
      item.stageId || '',
      user,
      NOTIFICATION_TYPES[`${type.toUpperCase()}_ADD`],
      newUserIds,
      `'{userName}' invited you to the ${type}: '${item.name}'.`,
      type,
    );
  }

  // remove from assignee users
  const removedUserIds = oldAssignedUserIds.filter(userId => assignedUserIds.indexOf(userId) < 0);

  if (removedUserIds.length > 0) {
    await sendNotifications(
      item.stageId || '',
      user,
      NOTIFICATION_TYPES[`${type.toUpperCase()}_REMOVE_ASSIGN`],
      removedUserIds,
      `'{userName}' removed you from ${type}: '${item.name}'.`,
      type,
    );
  }

  // dont assignee change and other edit
  if (removedUserIds.length === 0 && newUserIds.length === 0) {
    await sendNotifications(
      item.stageId || '',
      user,
      NOTIFICATION_TYPES[`${type.toUpperCase()}_EDIT`],
      assignedUserIds,
      `'{userName}' edited your ${type} '${item.name}'`,
      type,
    );
  }
};

export const itemsChange = async (
  collection: any,
  item: IDealDocument | ITicketDocument,
  type: string,
  destinationStageId?: string,
) => {
  const oldTicket = await collection.findOne({ _id: item._id });
  const oldStageId = oldTicket ? oldTicket.stageId || '' : '';

  let content = `'{userName}' changed order your ${type}:'${item.name}'`;

  if (oldStageId !== destinationStageId) {
    const stage = await Stages.findOne({ _id: destinationStageId });

    if (!stage) {
      throw new Error('Stage not found');
    }

    content = `'{userName}' moved your ${type} '${item.name}' to the '${stage.name}'.`;
  }

  return content;
};
