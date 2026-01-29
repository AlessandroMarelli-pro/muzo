type Branding<BrandT> = {
  _type: BrandT;
};

export type Brand<T, BrandT extends string> = T & Branding<BrandT>;

export type PlaylistId = Brand<string, 'PlaylistId'>;

export type UserId = Brand<string, 'UserId'>;
