import type Database from 'better-sqlite3'

/**
 * Seed function retained for schema compatibility — no longer inserts data.
 * Products and distributors come from the catalog import flow.
 */
export function seedData(_database: Database.Database): void {
  // eslint-disable-next-line no-constant-condition
  if (false) {
    const insertProduct = _database.prepare(
      `
      INSERT INTO products (
        sku, name, description, category, price, cost, quantity, barcode,
        tax_rate, dept_id, category_id, category_name, retail_price, in_stock,
        tax_1, tax_2, distributor_number, bottles_per_case
      )
      VALUES (
        @sku, @name, @description, @category, @price, @cost, @quantity, @barcode,
        @tax_rate, @dept_id, @category_id, @category_name, @retail_price, @in_stock,
        @tax_1, @tax_2, @distributor_number, @bottles_per_case
      )
      `
    )

    const seedProducts = [
      {
        sku: 'WINE-001',
        name: 'Cabernet Sauvignon 750ml',
        description: 'Dry red wine',
        category: 'Wine',
        price: 19.99,
        cost: 12.5,
        quantity: 24,
        barcode: '000111222333',
        tax_rate: 0.13,
        dept_id: 'WINE',
        category_id: 10,
        category_name: 'Wine',
        retail_price: 19.99,
        in_stock: 24,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'BEER-001',
        name: 'Craft IPA 6-Pack',
        description: 'Hoppy India Pale Ale',
        category: 'Beer',
        price: 13.49,
        cost: 8.25,
        quantity: 40,
        barcode: '000111222334',
        tax_rate: 0.13,
        dept_id: 'BEER',
        category_id: 20,
        category_name: 'Beer',
        retail_price: 13.49,
        in_stock: 40,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: 1,
        bottles_per_case: 6
      },
      {
        sku: 'SPIRIT-001',
        name: 'Premium Vodka 1L',
        description: 'Imported vodka',
        category: 'Spirits',
        price: 32.99,
        cost: 21,
        quantity: 18,
        barcode: '000111222335',
        tax_rate: 0.13,
        dept_id: 'SPIRITS',
        category_id: 30,
        category_name: 'Spirits',
        retail_price: 32.99,
        in_stock: 18,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'COOLER-001',
        name: 'Vodka Soda 473ml',
        description: 'Ready-to-drink cooler',
        category: 'Coolers',
        price: 4.25,
        cost: 2.5,
        quantity: 96,
        barcode: '000111222336',
        tax_rate: 0.13,
        dept_id: 'COOLERS',
        category_id: 40,
        category_name: 'Coolers',
        retail_price: 4.25,
        in_stock: 96,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'MIXER-001',
        name: 'Tonic Water 1L',
        description: 'Carbonated mixer',
        category: 'Mixers',
        price: 2.99,
        cost: 1.6,
        quantity: 52,
        barcode: '000111222337',
        tax_rate: 0.13,
        dept_id: 'MIXERS',
        category_id: 50,
        category_name: 'Mixers',
        retail_price: 2.99,
        in_stock: 52,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: 1,
        bottles_per_case: 12
      }
    ]

    const insertMany = _database.transaction((items: typeof seedProducts) => {
      for (const item of items) {
        insertProduct.run(item)
      }
    })

    insertMany(seedProducts)
  }
}
