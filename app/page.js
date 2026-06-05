'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

const CHARS = '0123456789ABCDEF';

export default function Home() {
  const [page, setPage] = useState('draw');
  const [status, setStatus] = useState('idle'); // idle | spinning | won | lost | empty | already
  const [code, setCode] = useState('');
  const [drums, setDrums] = useState(Array(12).fill('?'));
  const [progress, setProgress] = useState({ used: 0, total: 498 });
  const [stats, setStats] = useState(null);
  const [adminPass, setAdminPass] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchProgress(); }, []);

  async function fetchProgress() {
    try {
      const r = await fetch('/api/stats');
      const d = await r.json();
      setProgress({ used: d.used, total: d.total });
    } catch {}
  }

  async function fetchStats() {
    try {
      const r = await fetch('/api/stats');
      const d = await r.json();
      setStats(d);
      setProgress({ used: d.used, total: d.total });
    } catch {}
  }

  async function animateDrums(finalCode) {
    const chars = finalCode.replace(/-/g, '').split('');
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      if (s < steps) {
        setDrums(chars.map(() => CHARS[Math.floor(Math.random() * CHARS.length)]));
      } else {
        setDrums(chars);
      }
      await new Promise(r => setTimeout(r, s < steps - 3 ? 60 : 130));
    }
  }

  async function doDraw() {
    if (status === 'spinning') return;
    setStatus('spinning');
    setCode('');
    try {
      const r = await fetch('/api/draw', { method: 'POST' });
      const d = await r.json();
      if (d.status === 'won' || d.status === 'already_drawn') {
        await animateDrums(d.code);
        setCode(d.code);
        setStatus(d.status === 'already_drawn' ? 'already' : 'won');
      } else if (d.status === 'empty') {
        setStatus('empty');
        setDrums(Array(12).fill('-'));
      } else {
        setStatus('idle');
      }
      fetchProgress();
    } catch {
      setStatus('idle');
    }
  }

  async function doReset() {
    const r = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPass }),
    });
    const d = await r.json();
    if (d.status === 'ok') {
      setResetMsg('รีเซ็ตสำเร็จแล้ว');
      setConfirmReset(false);
      fetchStats();
    } else {
      setResetMsg('รหัสผ่านไม่ถูกต้อง');
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pct = progress.total > 0 ? (progress.used / progress.total) * 100 : 0;
  const drumDisplay = drums.slice(0, 4).join('') + '-' + drums.slice(4, 8).join('') + '-' + drums.slice(8, 12).join('');

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <button className={page === 'draw' ? styles.navActive : ''} onClick={() => setPage('draw')}>🎁 สุ่มรางวัล</button>
        <button className={page === 'admin' ? styles.navActive : ''} onClick={() => { setPage('admin'); fetchStats(); }}>📊 Admin</button>
      </nav>

      {page === 'draw' && (
        <div className={styles.drawPage}>
          <div className={styles.header}>
            <h1>🎁 สุ่มรับโค้ดรางวัล</h1>
            <p>กดปุ่มด้านล่างเพื่อลุ้นรับโค้ด</p>
          </div>

          <div className={styles.card}>
            <div className={styles.drumRow}>
              {drumDisplay.split('').map((ch, i) =>
                ch === '-'
                  ? <span key={i} className={styles.sep}>-</span>
                  : <div key={i} className={`${styles.drum} ${status === 'spinning' ? styles.drumSpin : ''}`}>{ch}</div>
              )}
            </div>

            {(status === 'won' || status === 'already') && code && (
              <div className={styles.resultWon}>
                <div className={styles.emoji}>🎉</div>
                <p className={styles.wonTitle}>ยินดีด้วย! คุณได้รับรางวัล</p>
                <div className={styles.codeBox}>{code}</div>
                <button className={styles.copyBtn} onClick={copyCode}>
                  {copied ? '✓ คัดลอกแล้ว!' : '📋 คัดลอกโค้ด'}
                </button>
                {status === 'already' && <p className={styles.note}>คุณได้ทำการสุ่มไปแล้วก่อนหน้านี้</p>}
              </div>
            )}

            {status === 'empty' && (
              <div className={styles.resultEmpty}>
                <div className={styles.emoji}>🎁</div>
                <p>โค้ดหมดแล้ว</p>
                <small>โค้ดทั้ง {progress.total} ถูกแจกครบแล้ว</small>
              </div>
            )}

            <button
              className={styles.drawBtn}
              onClick={doDraw}
              disabled={status === 'spinning' || status === 'empty'}
            >
              {status === 'spinning' ? 'กำลังสุ่ม...' : '✨ กดสุ่มรางวัล'}
            </button>

            <div className={styles.progressWrap}>
              <div className={styles.progressLabel}>
                <span>โค้ดที่แจกไปแล้ว</span>
                <span>{progress.used} / {progress.total}</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: pct + '%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {page === 'admin' && (
        <div className={styles.adminPage}>
          <h2>Admin panel</h2>

          {stats && (
            <>
              <div className={styles.metricGrid}>
                <div className={styles.metric}><div className={styles.metricLabel}>โค้ดทั้งหมด</div><div className={styles.metricValue}>{stats.total}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>แจกไปแล้ว</div><div className={`${styles.metricValue} ${styles.purple}`}>{stats.used}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>คงเหลือ</div><div className={`${styles.metricValue} ${styles.green}`}>{stats.remaining}</div></div>
              </div>

              <div className={styles.card}>
                <h3>IP ที่เคยสุ่ม (30 ล่าสุด)</h3>
                {stats.ipList.length === 0
                  ? <p className={styles.muted}>ยังไม่มีข้อมูล</p>
                  : stats.ipList.slice().reverse().map((item, i) => (
                    <div key={i} className={styles.ipRow}>
                      <span className={styles.ipAddr}>{item.ip}</span>
                      {item.code
                        ? <span className={`${styles.tag} ${styles.tagSuccess}`}>{item.code}</span>
                        : <span className={`${styles.tag} ${styles.tagDanger}`}>ไม่ได้รับ</span>}
                    </div>
                  ))
                }
              </div>
            </>
          )}

          <div className={styles.card}>
            <h3>รีเซ็ตระบบ</h3>
            <p className={styles.muted}>ลบข้อมูล IP และโค้ดที่แจกทั้งหมด</p>
            <input
              type="password"
              className={styles.input}
              placeholder="Admin password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
            />
            {!confirmReset
              ? <button className={styles.dangerBtn} onClick={() => setConfirmReset(true)}>🔄 รีเซ็ตทั้งหมด</button>
              : <div className={styles.confirmBox}>
                  <p>⚠️ ยืนยันการรีเซ็ต? ไม่สามารถกู้คืนได้</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className={styles.dangerBtn} onClick={doReset}>ยืนยัน</button>
                    <button className={styles.cancelBtn} onClick={() => setConfirmReset(false)}>ยกเลิก</button>
                  </div>
                </div>
            }
            {resetMsg && <p className={styles.resetMsg}>{resetMsg}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
