import assert from "node:assert/strict";
import { test } from "node:test";
import { loyaltyReward,scheduleError } from "../experience";
const now=Date.parse('2026-11-06T06:00:00Z');
const rules={schedulingEnabled:true,scheduleLeadMinutes:30,scheduleDaysAhead:7,scheduleOpenMinute:480,scheduleCloseMinute:120};
test('Pakistan schedule supports overnight hours and excludes closed window',()=>{
 assert.equal(scheduleError('2026-11-06T20:30:00Z',rules,now),null);
 assert.match(scheduleError('2026-11-06T22:30:00Z',rules,now)!,/hours/);
 assert.match(scheduleError('2026-11-06T06:29:00Z',rules,now)!,/30/);
 assert.equal(scheduleError('2026-11-06T06:30:00Z',rules,now),null);
 assert.match(scheduleError('2026-11-14T06:30:00Z',rules,now)!,/7/);
 assert.match(scheduleError('invalid',rules,now)!,/Choose/);
 assert.match(scheduleError('2026-11-06T07:30:00Z',{...rules,schedulingEnabled:false},now)!,/unavailable/);
});
test('one full reward requires enough balance and eligible items',()=>{
 assert.deepEqual(loyaltyReward(100,100,100,100),{points:100,discount:100});
 assert.deepEqual(loyaltyReward(99,100,100,100),{points:0,discount:0});
 assert.deepEqual(loyaltyReward(100,99,100,100),{points:0,discount:0});
 assert.deepEqual(loyaltyReward(-50,100,100,100),{points:0,discount:0});
});
