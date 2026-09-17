import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMER_CODE_PATTERN,normalizeCustomerCode,randomCustomerCode} from './customer-code.js';

test('customer codes use cashier-friendly format',()=>{
  for(let index=0;index<1000;index++)assert.match(randomCustomerCode(),CUSTOMER_CODE_PATTERN);
});

test('customer code generator has no duplicates in a representative batch',()=>{
  const codes=new Set(Array.from({length:10000},randomCustomerCode));
  assert.equal(codes.size,10000);
});

test('customer code normalization is strict',()=>{
  assert.equal(normalizeCustomerCode(' k7m4-p9q2 '),'K7M4-P9Q2');
  assert.equal(normalizeCustomerCode('K7M4P9Q2'),'');
  assert.equal(normalizeCustomerCode('K7M4-P9Q0'),'');
});
