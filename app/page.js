'use client';
import { useState, useEffect } from 'react';
import styles from './page.module.css';

const CHARS = '0123456789ABCDEF';
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export default function Home() {
  const [page, setPage] = useState('draw');
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState('idle');
  const [code, setCode] = useState('');
  const [drums, setDrums] = useState(Array(12).fill('?'));
  const [progress, setProgress] = useState({ used: 0, total: 1000 });
  const [stats, setStats] = useState(null);
  const [adminPass, setAdminPass] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [lineUser, setLineUser] = useState(null);
  const [liffReady, setLiffReady] = useState(false);
  const [liffLoading, setLiffLoading] = useState(true);

  useEffect(() => {
    fetchProgress();

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') setIsAdmin(true);

    initLiff();
  }, []);

  async function initLiff(retryCount = 0) {
    const liff = window.liff;
    if (!liff) {
      // SDK ยังโหลดไม่เสร็จ รอแล้ว retry
      if (retryCount < 10) {
        setTimeout(() => initLiff(retryCount + 1), 300);
      } else {
        setLiffLoading(false);
      }
      return;
    }

    try {
      await liff.init({ liffId: LIFF_ID });
      setLiffReady(true);
      setLiffLoading(false);

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        setLineUser({
          uid: profile.userId,
          name: profile.displayName,
          pic: profile.pictureUrl || '',
        });
      }
    } catch (err) {
      console.error('LIFF init failed', err);
      // retry อีกครั้งถ้ายังไม่เกิน 3 ครั้ง
      if (retryCount < 3) {
        setTimeout(() => initLiff(retryCount + 1), 1000);
      } else {
        setLiffLoading(false);
      }
    }
  }

  function handleLineLogin() {
    const liff = window.liff;
    if (!liff || !liffReady) return;
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  }

  async function fetchProgress() {
    try {
      const r = await fetch('/api/stats');
      const d = await r.json();
      setProgress({ used: d.used, total: d.total });
    } catch {}
  }

  async function fetchStats() {
    try {
      const r = await fetch(`/api/stats?admin_key=${encodeURIComponent(adminPass)}`);
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
    if (!lineUser) return;
    if (status === 'spinning') return;

    const liff = window.liff;
    if (!liff || !liff.isLoggedIn()) return;

    setStatus('spinning');
    setCode('');

    try {
      // ส่ง accessToken แทน uid ให้ server verify เอง
      const accessToken = liff.getAccessToken();

      const r = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const d = await r.json();

      if (d.status === 'won' || d.status === 'already_drawn') {
        await animateDrums(d.code);
        setCode(d.code);
        setStatus(d.status === 'already_drawn' ? 'already' : 'won');
      } else if (d.status === 'rate_limited') {
        setRetryAfter(d.retryAfter || 24);
        setStatus('rate_limited');
        setDrums(Array(12).fill('-'));
      } else if (d.status === 'empty') {
        setStatus('empty');
        setDrums(Array(12).fill('-'));
      } else if (d.status === 'unauthorized') {
        setStatus('auth_failed');
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
      setResetMsg('✅ รีเซ็ตสำเร็จแล้ว');
      setConfirmReset(false);
      setStats(null);
      fetchStats();
    } else {
      setResetMsg('❌ รหัสผ่านไม่ถูกต้อง');
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pct = progress.total > 0 ? (progress.used / progress.total) * 100 : 0;
  const drumStr = [
    ...drums.slice(0, 4), '-', ...drums.slice(4, 8), '-', ...drums.slice(8, 12)
  ];

  return (
    <main className={styles.main}>
      <img src="/banner.jpg" alt="banner" className={styles.banner} />

      <nav className={styles.nav}>
        <button className={page === 'draw' ? styles.navActive : ''} onClick={() => setPage('draw')}>🎁 สุ่มรางวัล</button>
        {isAdmin && (
          <button className={page === 'admin' ? styles.navActive : ''} onClick={() => setPage('admin')}>📊 Admin</button>
        )}
      </nav>

      {page === 'draw' && (
        <div className={styles.drawPage}>
          <div className={styles.header}>
            <h1>🎁 สุ่มรับโค้ดรางวัล</h1>
            <p>เข้าสู่ระบบด้วย LINE เพื่อลุ้นรับโค้ด</p>
          </div>

          <div className={styles.card}>
            <div className={styles.drumRow}>
              {drumStr.map((ch, i) =>
                ch === '-'
                  ? <span key={i} className={styles.sep}>-</span>
                  : <div key={i} className={`${styles.drum} ${status === 'spinning' ? styles.drumSpin : ''}`}>{ch}</div>
              )}
            </div>

            {/* กำลังโหลด LIFF */}
            {liffLoading && (
              <div className={styles.loginWrap}>
                <p className={styles.loginHint}>กำลังโหลด...</p>
              </div>
            )}

            {/* ยังไม่ได้ login */}
            {!liffLoading && !lineUser && status !== 'auth_failed' && (
              <div className={styles.loginWrap}>
                <p className={styles.loginHint}>กรุณาเข้าสู่ระบบด้วย LINE ก่อนสุ่มรางวัล</p>
                <button
                  onClick={handleLineLogin}
                  className={styles.lineBtn}
                  disabled={!liffReady}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.96 2 10.8c0 3.27 1.97 6.14 4.96 7.83-.21.78-.76 2.83-.87 3.27-.13.54.2.53.42.39.17-.11 2.76-1.83 3.88-2.57.53.07 1.07.11 1.61.11 5.52 0 10-3.96 10-8.83C22 5.96 17.52 2 12 2z"/></svg>
                  เข้าสู่ระบบด้วย LINE
                </button>
              </div>
            )}

            {/* auth failed */}
            {status === 'auth_failed' && (
              <div className={styles.resultEmpty}>
                <div className={styles.emoji}>⚠️</div>
                <p>เข้าสู่ระบบไม่สำเร็จ</p>
                <button onClick={handleLineLogin} className={styles.lineBtn} style={{marginTop: 12}}>ลองใหม่</button>
              </div>
            )}

            {/* login แล้ว */}
            {lineUser && (
              <div className={styles.userBar}>
                {lineUser.pic && <img src={lineUser.pic} className={styles.userPic} alt="" />}
                <span className={styles.userName}>{lineUser.name}</span>
              </div>
            )}

            {(status === 'won' || status === 'already') && code && (
              <div className={styles.resultWon}>
                <div className={styles.emoji}>🎉</div>
                <p className={styles.wonTitle}>ยินดีด้วย! คุณได้รับรางวัล</p>
                <div className={styles.codeBox}>{code}</div>
                <br />
                <button className={styles.copyBtn} onClick={copyCode}>
                  {copied ? '✓ คัดลอกแล้ว!' : '📋 คัดลอกโค้ด'}
                </button>
                {status === 'already' && (
                  <p className={styles.note}>⚠️ บัญชี LINE นี้เคยสุ่มไปแล้ว</p>
                )}
              </div>
            )}

            {status === 'rate_limited' && (
              <div className={styles.resultEmpty}>
                <div className={styles.emoji}>⏳</div>
                <p>คุณสุ่มไปแล้วในวันนี้</p>
                <small>สามารถสุ่มใหม่ได้ในอีกประมาณ {retryAfter} ชั่วโมง</small>
              </div>
            )}

            {status === 'empty' && (
              <div className={styles.resultEmpty}>
                <div className={styles.emoji}>🎁</div>
                <p>โค้ดหมดแล้ว</p>
                <small>โค้ดทั้ง {progress.total} ถูกแจกครบแล้ว</small>
              </div>
            )}

            {lineUser && status !== 'won' && status !== 'already' && status !== 'empty' && status !== 'rate_limited' && status !== 'auth_failed' && (
              <button
                className={styles.drawBtn}
                onClick={doDraw}
                disabled={status === 'spinning'}
              >
                {status === 'spinning' ? 'กำลังสุ่ม...' : '✨ กดสุ่มรางวัล'}
              </button>
            )}

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

      {isAdmin && page === 'admin' && (
        <div className={styles.adminPage}>
          <h2>Admin panel</h2>

          <div className={styles.card}>
            <h3>เข้าสู่ระบบ Admin</h3>
            <input
              type="password"
              className={styles.input}
              placeholder="Admin password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchStats()}
            />
            <button className={styles.drawBtn} style={{ marginTop: 8 }} onClick={fetchStats}>
              🔍 โหลดข้อมูล
            </button>
          </div>

          {stats && (
            <>
              <div className={styles.metricGrid}>
                <div className={styles.metric}><div className={styles.metricLabel}>โค้ดที่แสดง (total)</div><div className={styles.metricValue}>{stats.total}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>แจกไปแล้ว (display)</div><div className={`${styles.metricValue} ${styles.purple}`}>{stats.used}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>คงเหลือ (display)</div><div className={`${styles.metricValue} ${styles.green}`}>{stats.remaining}</div></div>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metric}><div className={styles.metricLabel}>โค้ดจริงทั้งหมด</div><div className={styles.metricValue}>{stats.realTotal}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>แจกจริงไปแล้ว</div><div className={`${styles.metricValue} ${styles.purple}`}>{stats.realUsed}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>โค้ดจริงคงเหลือ</div><div className={`${styles.metricValue} ${styles.green}`}>{stats.realTotal - stats.realUsed}</div></div>
              </div>

              <div className={styles.card}>
                <h3>ประวัติการสุ่ม (30 ล่าสุด)</h3>
                {!stats.logs || stats.logs.length === 0
                  ? <p className={styles.muted}>ยังไม่มีข้อมูล</p>
                  : stats.logs.map((item, i) => (
                    <div key={i} className={styles.ipRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 13 }}>👤 {item.uid}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{new Date(item.time).toLocaleString('th-TH')}</div>
                      </div>
                      <span className={`${styles.tag} ${styles.tagSuccess}`}>{item.code}</span>
                    </div>
                  ))
                }
              </div>
            </>
          )}

          <div className={styles.card}>
            <h3>รีเซ็ตระบบ</h3>
            <p className={styles.muted}>ลบข้อมูลทั้งหมด — LINE UID, Rate Limit, และโค้ดที่แจกไป</p>
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
