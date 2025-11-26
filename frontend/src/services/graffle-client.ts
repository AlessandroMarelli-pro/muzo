import { gql, GraphQLClient } from 'graphql-request';

// Create a GraphQL client instance
export const graffleClient = new GraphQLClient(
  'http://localhost:3000/graphql',
  {
    headers: {
      'Content-Type': 'application/json',
    },
  },
);

// Export the gql function for use in our hooks
export { gql };
