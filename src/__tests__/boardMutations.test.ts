import { graphqlRequest } from '../db/connection';
import { boardFactory, pipelineFactory, stageFactory, userFactory } from '../db/factories';
import { Boards, Deals, Pipelines, Stages } from '../db/models';
import { IBoardDocument, IPipelineDocument, IStageDocument } from '../db/models/definitions/boards';

import './setup.ts';

describe('Test boards mutations', () => {
  let board: IBoardDocument;
  let pipeline: IPipelineDocument;
  let stage: IStageDocument;
  let context;

  const commonPipelineParamDefs = `
    $name: String!,
    $boardId: String!,
    $stages: JSON,
    $type: String!
    $visibility: String!
  `;

  const commonPipelineParams = `
    name: $name
    boardId: $boardId
    stages: $stages
    type: $type
    visibility: $visibility
  `;

  beforeEach(async () => {
    // Creating test data
    board = await boardFactory();
    pipeline = await pipelineFactory({ boardId: board._id });
    stage = await stageFactory({ pipelineId: pipeline._id });
    context = { user: await userFactory({}) };
  });

  afterEach(async () => {
    // Clearing test data
    await Boards.deleteMany({});
    await Pipelines.deleteMany({});
    await Stages.deleteMany({});
    await Deals.deleteMany({});
  });

  test('Create board', async () => {
    const args = { name: 'deal board', type: 'deal' };

    const mutation = `
      mutation boardsAdd($name: String!, $type: String!) {
        boardsAdd(name: $name, type: $type) {
          _id
          name
          type
        }
      }
    `;

    const createdBoard = await graphqlRequest(mutation, 'boardsAdd', args, context);

    expect(createdBoard.name).toEqual(args.name);
    expect(createdBoard.type).toEqual(args.type);
  });

  test('Update board', async () => {
    const args = { _id: board._id, name: 'deal board', type: 'deal' };

    const mutation = `
      mutation boardsEdit($_id: String!, $name: String!, $type: String!) {
        boardsEdit(name: $name, _id: $_id, type: $type) {
          _id
          name
          type
        }
      }
    `;

    const updatedBoard = await graphqlRequest(mutation, 'boardsEdit', args, context);

    expect(updatedBoard.name).toEqual(args.name);
    expect(updatedBoard.type).toEqual(args.type);
  });

  test('Remove board', async () => {
    // disconnect pipeline connected to board
    await Pipelines.updateMany({}, { $set: { boardId: 'fakeBoardId' } });

    const mutation = `
      mutation boardsRemove($_id: String!) {
        boardsRemove(_id: $_id)
      }
    `;

    await graphqlRequest(mutation, 'boardsRemove', { _id: board._id }, context);

    expect(await Boards.findOne({ _id: board._id })).toBe(null);
  });

  test('Create pipeline', async () => {
    const args = {
      name: 'deal pipeline',
      type: 'deal',
      boardId: board._id,
      stages: [stage.toJSON()],
      visibility: 'public',
    };

    const mutation = `
      mutation pipelinesAdd(${commonPipelineParamDefs}) {
        pipelinesAdd(${commonPipelineParams}) {
          _id
          name
          type
          boardId
          visibility
        }
      }
    `;

    const createdPipeline = await graphqlRequest(mutation, 'pipelinesAdd', args, context);

    // stage connected to pipeline
    const stageToPipeline = await Stages.findOne({ _id: stage._id });

    if (!stageToPipeline) {
      throw new Error('Stage not found');
    }

    expect(createdPipeline._id).toEqual(stageToPipeline.pipelineId);
    expect(createdPipeline.name).toEqual(args.name);
    expect(createdPipeline.type).toEqual(args.type);
    expect(createdPipeline.visibility).toEqual(args.visibility);
    expect(createdPipeline.boardId).toEqual(board._id);
  });

  test('Update pipeline', async () => {
    const args = {
      _id: pipeline._id,
      name: 'deal pipeline',
      type: 'deal',
      boardId: board._id,
      stages: [stage.toJSON()],
      visibility: 'public',
    };

    const mutation = `
      mutation pipelinesEdit($_id: String!, ${commonPipelineParamDefs}) {
        pipelinesEdit(_id: $_id, ${commonPipelineParams}) {
          _id
          name
          type
          boardId
          visibility
        }
      }
    `;

    const updatedPipeline = await graphqlRequest(mutation, 'pipelinesEdit', args, context);

    // stage connected to pipeline
    const stageToPipeline = await Stages.findOne({ _id: stage._id });

    if (!stageToPipeline) {
      throw new Error('Stage not found');
    }

    expect(updatedPipeline._id).toEqual(stageToPipeline.pipelineId);
    expect(updatedPipeline.name).toEqual(args.name);
    expect(updatedPipeline.type).toEqual(args.type);
    expect(updatedPipeline.visibility).toEqual(args.visibility);
    expect(updatedPipeline.boardId).toEqual(board._id);
  });

  test('Pipeline update orders', async () => {
    const pipelineToUpdate = await pipelineFactory({});

    const args = {
      orders: [{ _id: pipeline._id, order: 9 }, { _id: pipelineToUpdate._id, order: 3 }],
    };

    const mutation = `
      mutation pipelinesUpdateOrder($orders: [OrderItem]) {
        pipelinesUpdateOrder(orders: $orders) {
          _id
          order
        }
      }
    `;

    const [updatedPipeline, updatedPipelineToOrder] = await graphqlRequest(
      mutation,
      'pipelinesUpdateOrder',
      args,
      context,
    );

    expect(updatedPipeline.order).toBe(3);
    expect(updatedPipelineToOrder.order).toBe(9);
  });

  test('Remove pipeline', async () => {
    // disconnect stages connected to pipeline
    await Stages.updateMany({}, { $set: { pipelineId: 'fakePipelineId' } });

    const mutation = `
      mutation pipelinesRemove($_id: String!) {
        pipelinesRemove(_id: $_id)
      }
    `;

    await graphqlRequest(mutation, 'pipelinesRemove', { _id: pipeline._id }, context);

    expect(await Pipelines.findOne({ _id: pipeline._id })).toBe(null);
  });

  test('Stage update orders', async () => {
    const stageToUpdate = await stageFactory({});

    const args = {
      orders: [{ _id: stage._id, order: 9 }, { _id: stageToUpdate._id, order: 3 }],
    };

    const mutation = `
      mutation stagesUpdateOrder($orders: [OrderItem]) {
        stagesUpdateOrder(orders: $orders) {
          _id
          order
        }
      }
    `;

    const [updatedStage, updatedStageToOrder] = await graphqlRequest(mutation, 'stagesUpdateOrder', args, context);

    expect(updatedStage.order).toBe(3);
    expect(updatedStageToOrder.order).toBe(9);
  });
});
