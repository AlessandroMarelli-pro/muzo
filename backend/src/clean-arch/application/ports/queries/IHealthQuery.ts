import { createToken } from '../../utils/create-token';
import { HealthInfo } from '../dtos/IHealthInfoDto';

export const HEALTH_QUERY = createToken<IHealthQuery>('HEALTH_QUERY');

export interface IHealthQuery {
  getHealthInfo(): Promise<HealthInfo>;
}
