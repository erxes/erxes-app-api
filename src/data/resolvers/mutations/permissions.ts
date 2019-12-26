import { Permissions, Users, UsersGroups } from '../../../db/models';
import { IPermissionParams, IUserGroup } from '../../../db/models/definitions/permissions';
import { MODULE_NAMES } from '../../constants';
import { resetPermissionsCache } from '../../permissions/utils';
import { moduleCheckPermission } from '../../permissions/wrappers';
import { IContext } from '../../types';
import { putCreateLog, putDeleteLog, putUpdateLog } from '../../utils';
import { LogDesc } from './logUtils';

const permissionMutations = {
  /**
   * Create new permission
   * @param {String} doc.module
   * @param {[String]} doc.actions
   * @param {[String]} doc.userIds
   * @param {Boolean} doc.allowed
   * @return {Promise} newly created permission object
   */
  async permissionsAdd(_root, doc: IPermissionParams, { user }: IContext) {
    const result = await Permissions.createPermission(doc);

    for (const perm of result) {
      let description = `Permission of module "${perm.module}", action "${perm.action}" assigned to `;

      const extraDesc: LogDesc[] = [];

      if (perm.groupId) {
        const group = await UsersGroups.getGroup(perm.groupId);

        description = `${description} user group "${group.name}" `;

        extraDesc.push({ groupId: perm.groupId, name: group.name });
      }

      if (perm.userId) {
        const permUser = await Users.getUser(perm.userId);

        description = `${description} user "${permUser.email}" has been created`;

        extraDesc.push({ userId: perm.userId, name: permUser.username || permUser.email });
      }

      await putCreateLog(
        {
          type: MODULE_NAMES.PERMISSION,
          object: perm,
          newData: JSON.stringify(perm),
          description,
          extraDesc: JSON.stringify(extraDesc),
        },
        user,
      );
    } // end for loop

    resetPermissionsCache();

    return result;
  },

  /**
   * Remove permission
   * @param {[String]} ids
   * @return {Promise}
   */
  async permissionsRemove(_root, { ids }: { ids: string[] }, { user }: IContext) {
    const permissions = await Permissions.find({ _id: { $in: ids } });
    const result = await Permissions.removePermission(ids);

    for (const perm of permissions) {
      let description = `Permission of module "${perm.module}", action "${perm.action}" assigned to `;

      const extraDesc: LogDesc[] = [];

      // prepare user group related description
      if (perm.groupId) {
        const group = await UsersGroups.getGroup(perm.groupId);

        description = `${description} user group "${group.name}" has been removed`;

        extraDesc.push({ groupId: perm.groupId, name: group.name });
      }

      // prepare user related description
      if (perm.userId) {
        const permUser = await Users.getUser(perm.userId);

        description = `${description} user "${permUser.email}" has been removed`;

        extraDesc.push({ userId: perm.userId, name: permUser.username || permUser.email });
      }

      await putDeleteLog(
        {
          type: MODULE_NAMES.PERMISSION,
          object: perm,
          description,
          extraDesc: JSON.stringify(extraDesc),
        },
        user,
      );
    } // end for loop

    resetPermissionsCache();

    return result;
  },
};

const usersGroupMutations = {
  /**
   * Create new group
   * @param {String} doc.name
   * @param {String} doc.description
   * @return {Promise} newly created group object
   */
  async usersGroupsAdd(_root, { memberIds, ...doc }: IUserGroup & { memberIds?: string[] }, { user }: IContext) {
    const result = await UsersGroups.createGroup(doc, memberIds);

    await putCreateLog(
      {
        type: MODULE_NAMES.USER_GROUP,
        object: result,
        newData: JSON.stringify(doc),
        description: `"${result.name}" has been created`,
      },
      user,
    );

    resetPermissionsCache();

    return result;
  },

  /**
   * Edit group
   * @param {String} doc.name
   * @param {String} doc.description
   * @return {Promise} updated group object
   */
  async usersGroupsEdit(
    _root,
    { _id, memberIds, ...doc }: { _id: string; memberIds?: string[] } & IUserGroup,
    { user }: IContext,
  ) {
    const group = await UsersGroups.getGroup(_id);
    const result = await UsersGroups.updateGroup(_id, doc, memberIds);

    await putUpdateLog(
      {
        type: MODULE_NAMES.USER_GROUP,
        object: group,
        newData: JSON.stringify(doc),
        description: `"${group.name}" has been edited`,
      },
      user,
    );

    resetPermissionsCache();

    return result;
  },

  /**
   * Remove group
   * @param {String} _id
   * @return {Promise}
   */
  async usersGroupsRemove(_root, { _id }: { _id: string }, { user }: IContext) {
    const group = await UsersGroups.getGroup(_id);
    const result = await UsersGroups.removeGroup(_id);

    await putDeleteLog(
      {
        type: MODULE_NAMES.USER_GROUP,
        object: group,
        description: `"${group.name}" has been removed`,
      },
      user,
    );

    resetPermissionsCache();

    return result;
  },
};

moduleCheckPermission(permissionMutations, 'managePermissions');
moduleCheckPermission(usersGroupMutations, 'manageUsersGroups');

export { permissionMutations, usersGroupMutations };
