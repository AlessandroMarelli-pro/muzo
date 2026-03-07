import { User } from "@/__generated__/types";
import { gql, graffleClient } from "@/services/graffle-client";
import { useQuery } from "@tanstack/react-query";

export const USER_QUERY = gql`
  query User {
    me {
      firstName
      lastName
      email
      randomTrackId
    }
  }
`;

export const fetchUser = async () => {
  const { me } = await graffleClient.request<{ me: User }>(USER_QUERY);
  return me;
};

export const useUser = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
  });
  return { user, isLoading };
};
