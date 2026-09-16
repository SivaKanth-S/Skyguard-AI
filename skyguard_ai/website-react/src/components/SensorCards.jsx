import React, { useState, useEffect } from 'react';

export default function SensorCards() {
  const [temp, setTemp] = useState(34.2);
  const [pres, setPres] = useState(1008.5);
  const [hum, setHum] = useState(72.3);

  useEffect(() => {
    const interval = setInterval(() => {
      setTemp(t => +(t + (Math.random() - 0.5) * 0.4).toFixed(1));
      setPres(p => +(p + (Math.random() - 0.5) * 0.3).toFixed(1));
      setHum(h => +(Math.min(99, Math.max(30, h + (Math.random() - 0.5) * 0.6))).toFixed(1));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sensor-group">
      <div className="scard" id="sc0">
        <div className="scard-icon">&#127977;</div>
        <div className="scard-val" id="sv0">{temp}&#176;C</div>
        <div className="scard-lbl">Temperature</div>
        <span className="scard-tag ok" id="st0">NORMAL</span>
      </div>
      <div className="scard" id="sc1">
        <div className="scard-icon">&#128309;</div>
        <div className="scard-val" id="sv1">{pres} hPa</div>
        <div className="scard-lbl">Pressure</div>
        <span className="scard-tag ok" id="st1">NORMAL</span>
      </div>
      <div className="scard" id="sc2">
        <div className="scard-icon">&#128167;</div>
        <div className="scard-val" id="sv2">{hum}%</div>
        <div className="scard-lbl">Humidity</div>
        <span className="scard-tag ok" id="st2">NORMAL</span>
      </div>
    </div>
  );
}
