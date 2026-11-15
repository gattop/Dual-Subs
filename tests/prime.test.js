'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPlaybackResources, adapter } = require('../platforms/prime.js');

// risposta di GetVodPlaybackResources
function playbackResources() {
  return {
    catalogMetadata: { catalog: { id: 'amzn1.dv.gti.1234', title: 'Titolo' } },
    timedTextUrls: {
      result: {
        subtitleUrls: [
          {
            url: 'https://cf.example/sub/en.ttml2', languageCode: 'en-us', displayName: 'English',
            type: 'Subtitle', subtype: 'Dialog', format: 'TTMLv2', timedTextTrackId: 'A1'
          },
          {
            url: 'https://cf.example/sub/en-sdh.ttml2', languageCode: 'en-us', displayName: 'English [CC]',
            type: 'Sdh', subtype: 'Dialog', format: 'TTMLv2', timedTextTrackId: 'A2'
          },
          {
            url: 'https://cf.example/sub/it.ttml2', languageCode: 'it-it', displayName: 'Italiano',
            type: 'Subtitle', subtype: 'Dialog', format: 'TTMLv2', timedTextTrackId: 'A3'
          },
          {
            url: 'https://cf.example/sub/de-auto.ttml2', languageCode: 'de-de', displayName: 'Deutsch',
            type: 'SubtitleMachineGenerated', subtype: 'Dialog', format: 'TTMLv2', timedTextTrackId: 'A4'
          },
          {
            url: 'https://cf.example/sub/it-forced.ttml2', languageCode: 'it-it', displayName: 'Italiano',
            type: 'ForcedNarrative', subtype: 'Dialog', format: 'TTMLv2'
          },
          {
            url: 'https://cf.example/sub/en-desc.ttml2', languageCode: 'en-us', displayName: 'English',
            type: 'Subtitle', subtype: 'Descriptive', format: 'TTMLv2'
          }
        ],
        forcedNarrativeUrls: []
      }
    }
  };
}

test('adattatore: riconosce Prime Video e i domini Amazon', () => {
  assert.ok(adapter.matches('www.primevideo.com'));
  assert.ok(adapter.matches('www.amazon.it'));
  assert.ok(adapter.matches('www.amazon.co.uk'));
  assert.ok(!adapter.matches('www.netflix.com'));
  assert.ok(!adapter.matches('amazon.it.example.org.evil'));
  assert.ok(!adapter.matches('www.amazon.xyz'));
});

test('extractPlaybackResources: tracce utilizzabili, CC, sottotitoli automatici', () => {
  const res = extractPlaybackResources(playbackResources());
  assert.equal(res.movieId, 'amzn1.dv.gti.1234');
  assert.deepEqual(res.tracks.map((t) => t.id), ['A1', 'A2', 'A3', 'A4']);
  assert.deepEqual(res.tracks[0], {
    id: 'A1', language: 'en-us', label: 'English', isClosedCaptions: false,
    url: 'https://cf.example/sub/en.ttml2', format: 'ttml', formats: ['TTMLv2']
  });
  assert.equal(res.tracks[1].isClosedCaptions, true);
  assert.equal(res.tracks[3].label, 'Deutsch [auto]');
});

test('extractPlaybackResources: senza catalogo l\'id viene dal primo URL', () => {
  const value = playbackResources();
  delete value.catalogMetadata;
  assert.equal(extractPlaybackResources(value).movieId, 'prime:sub/en.ttml2');
});

test('extractPlaybackResources: timedTextUrls presente ma senza elenco', () => {
  const res = extractPlaybackResources({ timedTextUrls: { error: { code: 'X' } } });
  assert.equal(res.tracks, null);
  assert.deepEqual(res.resultKeys, ['error']);
});

test('extractPlaybackResources ignora gli oggetti estranei', () => {
  assert.equal(extractPlaybackResources({ result: { movieId: 1 } }), null);
  assert.equal(extractPlaybackResources(null), null);
  assert.equal(extractPlaybackResources('timedTextUrls'), null);
  assert.equal(extractPlaybackResources([1]), null);
});

test('extractPlaybackResources: l\'id del titolo viene dall\'indirizzo della richiesta, se noto', () => {
  const url = 'https://atv-ps-eu.primevideo.com/playback/prs/GetVodPlaybackResources?deviceID=x&titleId=amzn1.dv.gti.abcd&gascEnabled=true';
  assert.equal(extractPlaybackResources(playbackResources(), url).movieId, 'amzn1.dv.gti.abcd');
  assert.equal(extractPlaybackResources(playbackResources(), 'https://example/x').movieId, 'amzn1.dv.gti.1234');
});
