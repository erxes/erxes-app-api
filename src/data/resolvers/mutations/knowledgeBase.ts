import { KnowledgeBaseArticles, KnowledgeBaseCategories, KnowledgeBaseTopics } from '../../../db/models';

import { ITopic } from '../../../db/models/definitions/knowledgebase';
import { IUserDocument } from '../../../db/models/definitions/users';
import { IArticleCreate, ICategoryCreate } from '../../../db/models/KnowledgeBase';
import { LOG_ACTIONS } from '../../constants';
import { moduleCheckPermission } from '../../permissions/wrappers';
import { putLog } from '../../utils';

const knowledgeBaseMutations = {
  /**
   * Create topic document
   */
  async knowledgeBaseTopicsAdd(_root, { doc }: { doc: ITopic }, { user }: { user: IUserDocument }) {
    const topic = await KnowledgeBaseTopics.createDoc(doc, user._id);

    if (topic) {
      await putLog(
        {
          type: 'knowledgeBaseTopic',
          action: LOG_ACTIONS.CREATE,
          newData: JSON.stringify(doc),
          objectId: topic._id,
          description: `${topic.title} has been created`,
        },
        user,
      );
    }

    return topic;
  },

  /**
   * Update topic document
   */
  async knowledgeBaseTopicsEdit(_root, { _id, doc }: { _id: string; doc: ITopic }, { user }: { user: IUserDocument }) {
    const topic = await KnowledgeBaseTopics.findOne({ _id });
    const updated = await KnowledgeBaseTopics.updateDoc(_id, doc, user._id);

    if (topic) {
      await putLog(
        {
          type: 'knowledgeBaseTopic',
          action: LOG_ACTIONS.UPDATE,
          oldData: JSON.stringify(topic),
          newData: JSON.stringify(doc),
          objectId: _id,
          description: `${topic.title} has been edited`,
        },
        user,
      );
    }

    return updated;
  },

  /**
   * Remove topic document
   */
  async knowledgeBaseTopicsRemove(_root, { _id }: { _id: string }, { user }: { user: IUserDocument }) {
    const topic = await KnowledgeBaseTopics.findOne({ _id });
    const removed = await KnowledgeBaseTopics.removeDoc(_id);

    if (topic) {
      await putLog(
        {
          type: 'knowledgeBaseTopic',
          action: LOG_ACTIONS.DELETE,
          oldData: JSON.stringify(topic),
          objectId: _id,
          description: `${topic.title} has been removed`,
        },
        user,
      );
    }

    return removed;
  },

  /**
   * Create category document
   */
  async knowledgeBaseCategoriesAdd(_root, { doc }: { doc: ICategoryCreate }, { user }: { user: IUserDocument }) {
    const kbCategory = await KnowledgeBaseCategories.createDoc(doc, user._id);

    await putLog(
      {
        type: 'knowledgeBaseCategory',
        action: LOG_ACTIONS.CREATE,
        newData: JSON.stringify(doc),
        objectId: kbCategory._id,
        description: `${kbCategory.title} has been created`,
      },
      user,
    );

    return kbCategory;
  },

  /**
   * Update category document
   */
  async knowledgeBaseCategoriesEdit(
    _root,
    { _id, doc }: { _id: string; doc: ICategoryCreate },
    { user }: { user: IUserDocument },
  ) {
    const kbCategory = await KnowledgeBaseCategories.findOne({ _id });
    const updated = await KnowledgeBaseCategories.updateDoc(_id, doc, user._id);

    if (kbCategory) {
      await putLog(
        {
          type: 'knowledgeBaseCategory',
          action: LOG_ACTIONS.UPDATE,
          oldData: JSON.stringify(kbCategory),
          newData: JSON.stringify(doc),
          description: `${kbCategory.title} has been edited`,
          objectId: kbCategory._id,
        },
        user,
      );
    }

    return updated;
  },

  /**
   * Remove category document
   */
  async knowledgeBaseCategoriesRemove(_root, { _id }: { _id: string }, { user }: { user: IUserDocument }) {
    const kbCategory = await KnowledgeBaseCategories.findOne({ _id });
    const removed = await KnowledgeBaseCategories.removeDoc(_id);

    if (kbCategory) {
      await putLog(
        {
          type: 'knowledgeBaseCategory',
          action: LOG_ACTIONS.DELETE,
          oldData: JSON.stringify(kbCategory),
          objectId: kbCategory._id,
          description: `${kbCategory.title} has been removed`,
        },
        user,
      );
    }

    return removed;
  },

  /**
   * Create article document
   */
  async knowledgeBaseArticlesAdd(_root, { doc }: { doc: IArticleCreate }, { user }: { user: IUserDocument }) {
    const kbArticle = await KnowledgeBaseArticles.createDoc(doc, user._id);

    await putLog(
      {
        type: 'knowledgeBaseArticle',
        action: LOG_ACTIONS.CREATE,
        newData: JSON.stringify(doc),
        description: `${kbArticle.title} has been created`,
        objectId: kbArticle._id,
      },
      user,
    );

    return kbArticle;
  },

  /**
   * Update article document
   */
  async knowledgeBaseArticlesEdit(
    _root,
    { _id, doc }: { _id: string; doc: IArticleCreate },
    { user }: { user: IUserDocument },
  ) {
    const kbArticle = await KnowledgeBaseArticles.findOne({ _id });
    const updated = await KnowledgeBaseArticles.updateDoc(_id, doc, user._id);

    if (kbArticle) {
      await putLog(
        {
          type: 'knowledgeBaseArticle',
          action: LOG_ACTIONS.UPDATE,
          oldData: JSON.stringify(kbArticle),
          newData: JSON.stringify(doc),
          description: `${kbArticle.title} has been edited`,
          objectId: _id,
        },
        user,
      );
    }

    return updated;
  },

  /**
   * Remove article document
   */
  async knowledgeBaseArticlesRemove(_root, { _id }: { _id: string }, { user }: { user: IUserDocument }) {
    const kbArticle = await KnowledgeBaseArticles.findOne({ _id });
    const removed = await KnowledgeBaseArticles.removeDoc(_id);

    if (kbArticle) {
      await putLog(
        {
          type: 'knowledgeBaseArticle',
          action: LOG_ACTIONS.DELETE,
          oldData: JSON.stringify(kbArticle),
          objectId: _id,
          description: `${kbArticle.title} has been removed`,
        },
        user,
      );
    }

    return removed;
  },
};

moduleCheckPermission(knowledgeBaseMutations, 'manageKnowledgeBase');

export default knowledgeBaseMutations;
