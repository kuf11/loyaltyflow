import crypto from 'node:crypto';

export const CUSTOMER_CODE_PATTERN=/^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCustomerCode(value){
  const code=String(value||'').trim().toUpperCase();
  return CUSTOMER_CODE_PATTERN.test(code)?code:'';
}

export function randomCustomerCode(){
  let value='';
  for(let index=0;index<8;index++)value+=ALPHABET[crypto.randomInt(ALPHABET.length)];
  return value.slice(0,4)+'-'+value.slice(4);
}
