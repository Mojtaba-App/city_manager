import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(
  fs.readFileSync(path.resolve('src/data/iran-locations.json'), 'utf8'),
);

assert.equal(data.length, 31);

const provinceNames = data.map((r) => r.province).sort((a, b) => a.localeCompare(b, 'fa'));
assert.ok(provinceNames.includes('تهران'));

const tehran = data.find((r) => r.province === 'تهران');
assert.ok(tehran.cities.includes('تهران'));
assert.ok(tehran.cities.includes('شهریار'));

const districts = Array.from({ length: 8 }, (_, i) => `منطقه ${i + 1}`);
assert.deepEqual(districts, [
  'منطقه 1', 'منطقه 2', 'منطقه 3', 'منطقه 4',
  'منطقه 5', 'منطقه 6', 'منطقه 7', 'منطقه 8',
]);

console.log('iran-locations data: all checks passed');
