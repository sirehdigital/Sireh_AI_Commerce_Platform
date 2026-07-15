export const SHOPIFY_PRODUCT_READ_LIMITS = {
  collections: 50,
  media: 50,
  variants: 100,
  inventoryLevels: 50,
} as const;

const PRODUCT_READ_FRAGMENT = `
  fragment SaieProductReadFields on Product {
    id
    title
    handle
    descriptionHtml
    vendor
    productType
    status
    tags
    templateSuffix
    onlineStoreUrl
    seo {
      title
      description
    }
    collections(first: 50) {
      pageInfo { hasNextPage }
      edges {
        node {
          id
          title
        }
      }
    }
    media(first: 50) {
      pageInfo { hasNextPage }
      edges {
        node {
          id
          alt
          ... on MediaImage {
            image {
              url
            }
          }
        }
      }
    }
    options {
      name
      values
    }
    variants(first: 100) {
      pageInfo { hasNextPage }
      edges {
        node {
          id
          title
          sku
          price
          compareAtPrice
          inventoryPolicy
          selectedOptions {
            name
            value
          }
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 50) {
              pageInfo { hasNextPage }
              edges {
                node {
                  location {
                    id
                    name
                  }
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const SHOPIFY_PRODUCT_BY_ID_READ_QUERY = `
  query SaieProductReadById($id: ID!) {
    shop {
      currencyCode
    }
    product(id: $id) {
      ...SaieProductReadFields
    }
  }
  ${PRODUCT_READ_FRAGMENT}
`;

export const SHOPIFY_PRODUCTS_BY_HANDLE_READ_QUERY = `
  query SaieProductReadByHandle($query: String!) {
    shop {
      currencyCode
    }
    products(first: 2, query: $query) {
      pageInfo { hasNextPage }
      edges {
        node {
          ...SaieProductReadFields
        }
      }
    }
  }
  ${PRODUCT_READ_FRAGMENT}
`;
