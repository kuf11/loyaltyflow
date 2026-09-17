import crypto from 'node:crypto';

export const CUSTOMER_CODE_PATTERN=/^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
export const CUSTOMER_CODE_TTL_MS=15*60*1000;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',BITS=40n,MASK=(1n<<BITS)-1n;

export function customerCodeSlot(now=Date.now()){return Math.floor(Number(now)/CUSTOMER_CODE_TTL_MS)}
export function normalizeCustomerCode(value){const code=String(value||'').trim().toUpperCase();return CUSTOMER_CODE_PATTERN.test(code)?code:''}
export function randomCustomerCode(){let value='';for(let index=0;index<8;index++)value+=ALPHABET[crypto.randomInt(ALPHABET.length)];return value.slice(0,4)+'-'+value.slice(4)}
function decode(code){let value=0n;for(const char of normalizeCustomerCode(code).replace('-','')){const index=ALPHABET.indexOf(char);if(index<0)return null;value=(value<<5n)|BigInt(index)}return value}
function encode(value){let text='';for(let index=0;index<8;index++){text=ALPHABET[Number(value&31n)]+text;value>>=5n}return text.slice(0,4)+'-'+text.slice(4)}
function keys(slot,secret){const hash=crypto.createHmac('sha256',String(secret)).update('loyalty-cashier-code:'+slot).digest(),a=(hash.readBigUInt64BE(0)&MASK)|1n,b=hash.readBigUInt64BE(8)&MASK;return{a,b}}
function inverseOdd(value){let result=value;for(let index=0;index<6;index++)result=(result*(2n-value*result))&MASK;return result}
export function rotateCustomerCode(code,slot,secret){const value=decode(code);if(value===null||!secret)return'';const{a,b}=keys(slot,secret);return encode((a*value+b)&MASK)}
export function unrotateCustomerCode(code,slot,secret){const value=decode(code);if(value===null||!secret)return'';const{a,b}=keys(slot,secret),inverse=inverseOdd(a);return encode(((value-b)&MASK)*inverse&MASK)}
