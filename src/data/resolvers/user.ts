import * as _ from 'underscore';
import { Permissions } from '../../db/models';
import { IUserDocument } from '../../db/models/definitions/users';

export default {
  status(user: IUserDocument) {
    if (user.registrationToken) {
      return 'Pending Invitation';
    }

    return 'Verified';
  },

  async permissionActions(user: IUserDocument) {
    const actions = await Permissions.find({
      $or: [{ userId: user._id }, { groupId: { $in: user.groupIds } }],
    }).select(['action', 'requiredActions']);

    const pluckedActions = _.pluck(actions, 'requiredActions');
    const requiredActions = [].concat(...pluckedActions);

    const actionNames = [..._.pluck(actions, 'action'), ...requiredActions];

    return _.uniq(actionNames);
  },
};
