import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data: string | undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest();
  const user = request.user as Record<string, unknown>;
  if (!data) return user;
  return user?.[data];
});
