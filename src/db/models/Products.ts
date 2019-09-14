import { Model, model } from 'mongoose';
import { Deals } from '.';
import {
  IProduct,
  IProductCategory,
  IProductDocument,
  productCategorySchema,
  productSchema,
} from './definitions/deals';

export interface IProductModel extends Model<IProductDocument> {
  createProduct(doc: IProduct): Promise<IProductDocument>;
  updateProduct(_id: string, doc: IProduct): Promise<IProductDocument>;
  removeProduct(_id: string): void;
}

export const loadProductClass = () => {
  class Product {
    /**
     * Create a product
     */
    public static async createProduct(doc: IProduct) {
      return Products.create(doc);
    }

    /**
     * Update Product
     */
    public static async updateProduct(_id: string, doc: IProduct) {
      await Products.updateOne({ _id }, { $set: doc });

      return Products.findOne({ _id });
    }

    /**
     * Remove Product
     */
    public static async removeProduct(_id: string) {
      const product = await Products.findOne({ _id });

      if (!product) {
        throw new Error('Product not found');
      }

      const count = await Deals.find({
        'productsData.productId': { $in: [_id] },
      }).countDocuments();

      if (count > 0) {
        throw new Error("Can't remove a product");
      }

      return Products.deleteOne({ _id });
    }
  }

  productSchema.loadClass(Product);

  return productSchema;
};

export interface IProductModel extends Model<IProductDocument> {
  createProduct(doc: IProduct): Promise<IProductDocument>;
  updateProduct(_id: string, doc: IProduct): Promise<IProductDocument>;
  removeProduct(_id: string): void;
}

export const loadProductCategoryClass = () => {
  class ProductCategory {
    /**
     * Create a product categorys
     */
    public static async createProductCategory(doc: IProductCategory) {
      return ProductsCategories.create(doc);
    }

    /**
     * Update Product category
     */
    public static async updateProduct(_id: string, doc: IProductCategory) {
      await ProductsCategories.updateOne({ _id }, { $set: doc });

      return ProductsCategories.findOne({ _id });
    }

    /**
     * Remove Product category
     */
    public static async removeProduct(_id: string) {
      const productCategory = await ProductsCategories.findOne({ _id });

      if (!productCategory) {
        throw new Error('Product category not found');
      }

      const count = await Products.find({ categoryId: _id }).countDocuments();

      if (count > 0) {
        throw new Error("Can't remove a product category");
      }

      return ProductsCategories.deleteOne({ _id });
    }
  }

  productCategorySchema.loadClass(ProductCategory);

  return productCategorySchema;
};

loadProductClass();
loadProductCategoryClass();

// tslint:disable-next-line
export const Products = model<IProductDocument, IProductModel>('products', productSchema);

// tslint:disable-next-line
export const ProductsCategories = model<IProductDocument, IProductModel>('product_categories', productCategorySchema);
