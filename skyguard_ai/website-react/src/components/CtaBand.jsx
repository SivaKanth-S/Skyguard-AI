import React from 'react';
import { Link } from 'react-router-dom';

export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="wrap cta-row">
        <div>
          <h2>Ready to explore?</h2>
          <p>Open the live anomaly monitor or read about the detection pipeline.</p>
        </div>
        <div className="cta-btns">
          <Link to="/dashboard" className="btn btn-primary">
            Open Dashboard
          </Link>
          <Link to="/architecture" className="btn btn-ghost">
            View Architecture
          </Link>
        </div>
      </div>
    </section>
  );
}
