import { graphqlRequest } from '../db/connection';
import { productCategoryFactory, productFactory } from '../db/factories';
import { Products } from '../db/models';
import { PRODUCT_TYPES } from '../db/models/definitions/constants';

import './setup.ts';

describe('productQueries', () => {
  afterEach(async () => {
    // Clearing test data
    await Products.deleteMany({});
  });

  test('Products', async () => {
    const args = {
      page: 1,
      perPage: 2,
    };

    await productFactory();
    await productFactory();
    await productFactory();

    const qry = `
      query products($page: Int $perPage: Int) {
        products(page: $page perPage: $perPage) {
          _id
          name
          type
          description
          sku
          createdAt
        }
      }
    `;

    const response = await graphqlRequest(qry, 'products', args);

    expect(response.length).toBe(2);
  });

  test('Products total count', async () => {
    const args = { type: PRODUCT_TYPES.PRODUCT };

    await productFactory({ type: PRODUCT_TYPES.PRODUCT });
    await productFactory({ type: PRODUCT_TYPES.SERVICE });
    await productFactory({ type: PRODUCT_TYPES.PRODUCT });

    const qry = `
      query productsTotalCount($type: String) {
        productsTotalCount(type: $type)
      }
    `;

    const response = await graphqlRequest(qry, 'productsTotalCount', args);

    expect(response).toBe(2);
  });

  test('Product categories', async () => {
    const parent = await productCategoryFactory({ code: '1' });
    await productCategoryFactory({ parentId: parent._id, code: '2' });
    await productCategoryFactory({ parentId: parent._id, code: '3' });

    const qry = `
      query productCategories($parentId: String $searchValue: String) {
        productCategories(parentId: $parentId searchValue: $searchValue) {
          _id
          name
          parentId
        }
      }
    `;

    let response = await graphqlRequest(qry, 'productCategories');

    expect(response.length).toBe(3);

    response = await graphqlRequest(qry, 'productCategories', { parentId: parent._id });

    expect(response.length).toBe(2);

    response = await graphqlRequest(qry, 'productCategories', { searchValue: parent.name });

    expect(response[0].name).toBe(parent.name);
  });
});
