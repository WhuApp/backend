import { Env, Service } from './types';
import friendsService from './services/friends_v1';
import usersService from './services/users_v1';
import locationsService from './services/locations_v1';

export default <ExportedHandler<Env>>{
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const services: Service[] = [friendsService, usersService, locationsService];

      const path: string[] = url.pathname.split('/').slice(1);
      const pathService: string = path[0];
      const pathVersion: string = path[1];

      const activeServices = services.filter(
        (service) => service.path === `/${pathService}/${pathVersion}/`
      );

      //maybe execute all found services. Atm just execute the first valid one found
      if (activeServices.length == 1)
        return await activeServices[0].fetch(
          request,
          env,
          url.pathname.substring(`/${pathService}/${pathVersion}/`.length)
        );

      throw new Error();
    } catch (error: any) {
      if (error.message) {
        return new Response(error.message, { status: 500 });
      } else {
        return new Response(JSON.stringify(error), { status: 500 });
      }
    }
  },
};
