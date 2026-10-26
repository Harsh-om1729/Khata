import { beforeAll, describe, expect, it } from 'vitest';
import { id, insertBill, must, mustOk, newDevice, now, paymentRow, seedShop, type Device, type Shop } from './helpers';

let phone: Device;
let shop: Shop;

beforeAll(async () => {
  [phone, shop] = await Promise.all([newDevice(), seedShop()]);
});

async function pay(fields: Record<string, unknown>) {
  mustOk(await phone.client.from('payments').insert(paymentRow(phone, shop, fields)));
}

describe('udhaar balance', () => {
  it('equals opening + udhaar sales - repayments, ignoring voided bills', async () => {
    const customer = shop.customerId;
    await pay({ customer_id: customer, method: 'udhaar', type: 'opening', amount_paise: 100_000 });

    // Part-paid bill: 200 cash now, 300 on udhaar.
    const partPaid = await insertBill(phone, shop, 50_000, { customer_id: customer });
    await pay({ bill_id: partPaid.id, customer_id: customer, method: 'cash', type: 'sale', amount_paise: 20_000 });
    await pay({ bill_id: partPaid.id, customer_id: customer, method: 'udhaar', type: 'sale', amount_paise: 30_000 });

    await pay({ customer_id: customer, method: 'upi', type: 'repayment', amount_paise: 25_000 });

    const voided = await insertBill(phone, shop, 40_000, { customer_id: customer });
    await pay({ bill_id: voided.id, customer_id: customer, method: 'udhaar', type: 'sale', amount_paise: 40_000 });
    mustOk(await phone.client.from('voids').insert({
      id: id(), device_id: phone.deviceId, bill_id: voided.id, staff_id: shop.staffId, reason: 'wrong customer', created_at: now(),
    }));

    const row = must(await phone.client.from('customer_balances').select('balance_paise').eq('customer_id', customer).single());
    // 1000 + 300 - 250 = 1050 rupees
    expect(row.balance_paise).toBe(105_000);
  });

  it('rejects an udhaar payment with no customer', async () => {
    const bill = await insertBill(phone, shop, 100);
    const { error } = await phone.client.from('payments').insert(
      paymentRow(phone, shop, { bill_id: bill.id, method: 'udhaar', type: 'sale', amount_paise: 100 }),
    );
    expect(error?.code).toBe('23514');
  });

  it('rejects a zero or negative payment', async () => {
    const { error } = await phone.client.from('payments').insert(
      paymentRow(phone, shop, { customer_id: shop.customerId, method: 'cash', type: 'repayment', amount_paise: 0 }),
    );
    expect(error?.code).toBe('23514');
  });
});

describe('voids', () => {
  it('a voided bill stays visible with status voided', async () => {
    const bill = await insertBill(phone, shop, 1_000);
    mustOk(await phone.client.from('voids').insert({
      id: id(), device_id: phone.deviceId, bill_id: bill.id, staff_id: shop.staffId, reason: 'mistake', created_at: now(),
    }));
    const row = must(await phone.client.from('bills_with_status').select('status').eq('id', bill.id).single());
    expect(row.status).toBe('voided');
  });

  it('any approved phone can void, without the owner (SPEC §2.1)', async () => {
    const bill = await insertBill(phone, shop, 1_000);
    const { error } = await phone.client.from('voids').insert({
      id: id(), device_id: phone.deviceId, bill_id: bill.id, staff_id: shop.staffId, reason: 'mistake', created_at: now(),
    });
    expect(error).toBeNull();
  });

  it('a void needs a reason', async () => {
    const bill = await insertBill(phone, shop, 1_000);
    const { error } = await phone.client.from('voids').insert({
      id: id(), device_id: phone.deviceId, bill_id: bill.id, staff_id: shop.staffId, reason: '  ', created_at: now(),
    });
    expect(error?.code).toBe('23514');
  });

  it('a bill can be voided only once', async () => {
    const bill = await insertBill(phone, shop, 1_000);
    const voidRow = () => ({
      id: id(), device_id: phone.deviceId, bill_id: bill.id, staff_id: shop.staffId, reason: 'mistake', created_at: now(),
    });
    mustOk(await phone.client.from('voids').insert(voidRow()));
    expect((await phone.client.from('voids').insert(voidRow())).error?.code).toBe('23505');
  });
});
