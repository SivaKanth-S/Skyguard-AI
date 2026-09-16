import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function MiniChart({ data, color = '#58a6ff', isMulti = false }) {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    let datasets = [];
    let labels = [];

    if (isMulti) {
      const { t, h } = data;
      labels = t.map((_, i) => i);
      datasets = [
        {
          data: t,
          borderColor: '#e74c3c',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
        {
          data: h,
          borderColor: '#2ecc71',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        }
      ];
    } else {
      labels = data.map((_, i) => i);
      datasets = [
        {
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          spanGaps: false,
        }
      ];
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, color, isMulti]);

  return (
    <div style={{ width: '100%', height: '70px', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
