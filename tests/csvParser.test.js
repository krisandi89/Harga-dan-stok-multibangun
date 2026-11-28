import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvFull } from '../api/_csvParser.js';

test('parseCsvFull handles empty input cleanly', () => {
  assert.deepEqual(parseCsvFull(''), { headers: [], data: [] });
  assert.deepEqual(parseCsvFull('   \r\n  '), { headers: [], data: [] });
});

test('parseCsvFull strips UTF-8 BOM and parses standard HARGA rows', () => {
  const csv = '\uFEFFBrand,Material,Harga Satuan\r\nTENSAR,SS20,"$3,00"\r\nHUITEX,"HDPE ""80"" Mil","$4,50"';
  const result = parseCsvFull(csv, false);

  assert.deepEqual(result.headers, ['Brand', 'Material', 'Harga Satuan']);
  assert.equal(result.data.length, 2);
  assert.deepEqual(result.data[0], ['TENSAR', 'SS20', '$3,00']);
  assert.deepEqual(result.data[1], ['HUITEX', 'HDPE "80" Mil', '$4,50']);
});

test('parseCsvFull preserves multiline quoted cells and forward-fills merged Brand in STOK mode', () => {
  const csv = [
    'Judul Laporan Stok,,,,',
    ',,,,',
    'Brand,Material,Dimensi Roll,Saldo,,Keterangan,Gudang',
    'Tensar Geogrid,Connector,250 buah / box,100,pcs,"Baris 1\nBaris 2",Gudang Bitung',
    ',SS20,3.8m x 75m,50,m2,1 Roll,Gudang Bitung',
    'HUITEX,HDPE 80 MIL,7m x 105m,735,m2,-,Gudang Bitung',
    ',LLDPE 80 MIL,7m x 105m,735,m2,-,Gudang Bitung'
  ].join('\r\n');

  const result = parseCsvFull(csv, true);
  assert.equal(result.headers[0], 'Brand');
  assert.equal(result.data.length, 4);
  assert.equal(result.data[0][5], 'Baris 1\nBaris 2');
  assert.equal(result.data[1][0], 'Tensar Geogrid');
  assert.equal(result.data[2][0], 'HUITEX');
  assert.equal(result.data[3][0], 'HUITEX');
});
