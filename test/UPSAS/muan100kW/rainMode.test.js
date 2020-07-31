const _ = require('lodash');
const moment = require('moment');

const { expect } = require('chai');

const RainMode = require('../../../src/projects/UPSAS/muan100kW/RainMode');

const rainMode = new RainMode({ main_seq: 1, weather_location_seq: 2658 });

describe('시나리오 동작 테스트', function() {
  before(() => {
    rainMode.getWeatherCast = (prevMin = 60, ptys = [0, 0]) => {
      return ptys
        .map(pty => {
          return {
            applydate: moment()
              .subtract(prevMin, 'minute')
              .format('YYYY-MM-DD hh:00:00'),
            pty,
          };
        })
        .reverse();
    };

    rainMode.getWeatherDevice = (prevMin = 10, rh = [0, 1], rd = [0, 10]) => {
      
  });

  it('기능 테스트', async () => {
    const wcRows = rainMode.getWeatherCast(40, [0, 1]);
    expect(wcRows).length(2);
    expect(wcRows[0].pty).to.eq(1);
  });
});
