import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMER_CODE_PATTERN,customerCodeSlot,normalizeCustomerCode,randomCustomerCode,rotateCustomerCode,unrotateCustomerCode} from './customer-code.js';

test('customer codes use cashier-friendly format',()=>{for(let index=0;index<1000;index++)assert.match(randomCustomerCode(),CUSTOMER_CODE_PATTERN)});
test('customer code normalization is strict',()=>{assert.equal(normalizeCustomerCode(' k7m4-p9q2 '),'K7M4-P9Q2');assert.equal(normalizeCustomerCode('K7M4P9Q2'),'');assert.equal(normalizeCustomerCode('K7M4-P9Q0'),'')});
test('rotating code is reversible and changes every 15 minutes',()=>{const base='K7M4-P9Q2',secret='test-secret',slot=customerCodeSlot(1800000),first=rotateCustomerCode(base,slot,secret),second=rotateCustomerCode(base,slot+1,secret);assert.match(first,CUSTOMER_CODE_PATTERN);assert.notEqual(first,second);assert.equal(unrotateCustomerCode(first,slot,secret),base)});
test('rotation preserves uniqueness within a time slot',()=>{const secret='test-secret',slot=12345,bases=new Set(),rotated=new Set();while(bases.size<10000)bases.add(randomCustomerCode());for(const base of bases)rotated.add(rotateCustomerCode(base,slot,secret));assert.equal(rotated.size,bases.size)});
