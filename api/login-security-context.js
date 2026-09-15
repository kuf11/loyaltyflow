import {AsyncLocalStorage} from 'node:async_hooks';
export const loginSecurityContext=new AsyncLocalStorage();
export const isLoginCaptchaVerified=()=>loginSecurityContext.getStore()===true;
