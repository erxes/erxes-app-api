import { Tasks } from '../../../db/models';
import { IOrderInput } from '../../../db/models/definitions/boards';
import { NOTIFICATION_TYPES } from '../../../db/models/definitions/constants';
import { ITask } from '../../../db/models/definitions/tasks';
import { IUserDocument } from '../../../db/models/definitions/users';
import { saveConformity } from '../../modules/conformity/conformityUtils';
import { checkPermission } from '../../permissions/wrappers';
import { itemsChange, sendNotifications } from '../boardUtils';
import { checkUserIds } from './notifications';

interface ITasksEdit extends ITask {
  _id: string;
}

const taskMutations = {
  /**
   * Create new task
   */
  async tasksAdd(_root, doc: ITask, { user }: { user: IUserDocument }) {
    const task = await Tasks.createTask({
      ...doc,
      modifiedBy: user._id,
    });

    await sendNotifications({
      item: task,
      user,
      type: NOTIFICATION_TYPES.TASK_ADD,
      action: `invited you to the`,
      content: `'${task.name}'.`,
      contentType: 'task',
    });

    return task;
  },

  /**
   * Edit task
   */
  async tasksEdit(_root, { _id, ...doc }: ITasksEdit, { user }) {
    const oldTask = await Tasks.findOne({ _id });

    if (!oldTask) {
      throw new Error('Task not found');
    }

    const updatedTask = await Tasks.updateTask(_id, {
      ...doc,
      modifiedAt: new Date(),
      modifiedBy: user._id,
    });

    const { addedUserIds, removedUserIds } = checkUserIds(oldTask.assignedUserIds || [], doc.assignedUserIds || []);

    await sendNotifications({
      item: updatedTask,
      user,
      type: NOTIFICATION_TYPES.TASK_EDIT,
      invitedUsers: addedUserIds,
      removedUsers: removedUserIds,
      contentType: 'task',
    });

    return updatedTask;
  },

  /**
   * Change task
   */
  async tasksChange(
    _root,
    { _id, destinationStageId }: { _id: string; destinationStageId: string },
    { user }: { user: IUserDocument },
  ) {
    const task = await Tasks.updateTask(_id, {
      modifiedAt: new Date(),
      modifiedBy: user._id,
      stageId: destinationStageId,
    });

    const { content, action } = await itemsChange(Tasks, task, 'task', destinationStageId);

    await sendNotifications({
      item: task,
      user,
      type: NOTIFICATION_TYPES.TASK_CHANGE,
      action,
      content,
      contentType: 'task',
    });

    return task;
  },

  /**
   * Update task orders (not sendNotifaction, ordered card to change)
   */
  tasksUpdateOrder(_root, { stageId, orders }: { stageId: string; orders: IOrderInput[] }) {
    return Tasks.updateOrder(stageId, orders);
  },

  /**
   * Remove task
   */
  async tasksRemove(_root, { _id }: { _id: string }, { user }: { user: IUserDocument }) {
    const task = await Tasks.findOne({ _id });

    if (!task) {
      throw new Error('Task not found');
    }

    await sendNotifications({
      item: task,
      user,
      type: NOTIFICATION_TYPES.TASK_DELETE,
      action: `deleted task:`,
      content: `'${task.name}'`,
      contentType: 'task',
    });

    return task.remove();
  },

  /**
   * Watch task
   */
  async tasksWatch(_root, { _id, isAdd }: { _id: string; isAdd: boolean }, { user }: { user: IUserDocument }) {
    const task = await Tasks.findOne({ _id });

    if (!task) {
      throw new Error('Task not found');
    }

    return Tasks.watchTask(_id, isAdd, user._id);
  },

  async tasksEditCompanies(_root, { _id, companyIds }: { _id: string; companyIds: string[] }) {
    const task = await Tasks.findOne({ _id });

    if (!task) {
      throw new Error('Task not found');
    }

    saveConformity({ mainType: 'task', mainTypeId: _id, relType: 'company', relTypeIds: companyIds });

    return task;
  },

  async tasksEditCustomers(_root, { _id, companyIds }: { _id: string; companyIds: string[] }) {
    const task = await Tasks.findOne({ _id });

    if (!task) {
      throw new Error('Task not found');
    }

    saveConformity({ mainType: 'task', mainTypeId: _id, relType: 'customer', relTypeIds: companyIds });

    return task;
  },
};

checkPermission(taskMutations, 'tasksAdd', 'tasksAdd');
checkPermission(taskMutations, 'tasksEdit', 'tasksEdit');
checkPermission(taskMutations, 'tasksUpdateOrder', 'tasksUpdateOrder');
checkPermission(taskMutations, 'tasksRemove', 'tasksRemove');
checkPermission(taskMutations, 'tasksWatch', 'tasksWatch');

export default taskMutations;
