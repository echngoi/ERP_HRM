import { useState, useEffect, useCallback } from 'react';
import {
  Card, DatePicker, Select, Button, Row, Col, Typography, message,
  Space, Tooltip, Spin, Tag, Statistic, Empty, Alert, Tabs, Table, Grid, Dropdown,
} from 'antd';
import {
  CalendarOutlined, SearchOutlined, CheckCircleOutlined,
  CloseCircleOutlined, UserOutlined, PrinterOutlined,
  WarningOutlined, DollarOutlined, FileExcelOutlined, MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAttendanceReport, getEmployees, getMyAttendanceInfo, exportAttendanceReport, getLeaveRequests, getOvertimeRequests, getOffsiteRequests } from '../../services/attendanceApi';

const { Title, Text } = Typography;

/* ── helpers ─────────────────────────────────────────── */
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function daysInMonth(month /* dayjs */) {
  const total = month.daysInMonth();
  const arr = [];
  for (let d = 1; d <= total; d++) {
    const dt = month.date(d);
    arr.push({ day: d, dow: dt.day(), date: dt.format('YYYY-MM-DD'), isWeekend: dt.day() === 0 || dt.day() === 6 });
  }
  return arr;
}

/** Lọc lần chấm công theo loại ca: lấy lần đầu + N-1 lần cuối */
function filterPunches(punches, shift) {
  if (!punches || punches.length === 0) return punches;
  let maxPunches = 2; // mặc định ca HC
  if (shift) {
    if (shift.type === '3punch') maxPunches = 3;
    else if (shift.type === '4punch') maxPunches = 4;
  }
  if (punches.length <= maxPunches) return punches;
  // Lần đầu tiên + (maxPunches - 1) lần cuối cùng
  return [punches[0], ...punches.slice(-(maxPunches - 1))];
}

/**
 * Tính ngày công cho 1 ô ngày:
 * - Nghỉ phép có lương: full=1, half=0.5
 * - Ngoại viện: full=1, half=0.5
 * - Chấm công: có giờ vào (<12h) + giờ ra (>=17h) = 1, chỉ 1 buổi = 0.5
 * Kết hợp half-leave + half-offsite, half-leave + attendance, half-offsite + attendance...
 */
function calcWorkDay(info, leaveRec, offsiteRec) {
  let val = 0;
  // Paid leave contribution
  if (leaveRec && leaveRec.paid_type === 'PAID') {
    if (leaveRec.leave_type === 'FULL_DAY') return 1;
    val += 0.5;
  }
  // Offsite contribution
  if (offsiteRec) {
    if (offsiteRec.work_type === 'FULL_DAY') return val > 0 ? Math.min(val + 1, 1) : 1;
    val += 0.5;
  }
  // If we already have 1 from leave+offsite combos, done
  if (val >= 1) return 1;
  // Attendance contribution (only for the remaining portion)
  if (info && info.status !== 'absent') {
    const punches = info.punches || [];
    const ci = punches[0] || info.check_in;
    const co = punches.length > 1 ? punches[punches.length - 1] : info.check_out;
    const hasMorning = ci && ci < '12:00';
    const hasAfternoon = co && co >= '17:00';
    if (hasMorning && hasAfternoon) {
      val += (val === 0) ? 1 : 0.5; // fill remaining
    } else if (hasMorning || hasAfternoon) {
      val += 0.5;
    }
  }
  return Math.min(val, 1);
}

/** Ngày công chuẩn = tổng ngày trong tháng - số ngày Chủ nhật */
function calcStandardDays(days) {
  return days.filter(d => d.dow !== 0).length;
}

/* ── component ───────────────────────────────────────── */
export default function MonthlyAttendance() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [month, setMonth]             = useState(dayjs().startOf('month'));
  const [employees, setEmployees]     = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [reportData, setReportData]   = useState(null);
  const [attInfo, setAttInfo]         = useState(null);
  const [leaveMap, setLeaveMap]       = useState({});
  const [otMap, setOtMap]             = useState({});
  const [offsiteMap, setOffsiteMap]   = useState({});

  const canViewAll = attInfo?.view_all_pages?.includes('monthly');

  useEffect(() => {
    getMyAttendanceInfo().then(r => setAttInfo(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (canViewAll) {
      getEmployees().then(r => setEmployees(r.data.results || [])).catch(() => {});
    }
  }, [canViewAll]);

  const days = daysInMonth(month);

  const fetchReport = useCallback(async () => {
    if (!attInfo) return;  // wait for info to load
    setLoading(true);
    try {
      const params = {
        date_from: month.startOf('month').format('YYYY-MM-DD'),
        date_to:   month.endOf('month').format('YYYY-MM-DD'),
        _page: 'monthly',
      };
      if (canViewAll && selectedUser) params.user_id = selectedUser;
      const [res, leaveRes, otRes, offsiteRes] = await Promise.all([
        getAttendanceReport(params),
        getLeaveRequests({ year: month.year(), month: month.month() + 1, status: 'APPROVED' }).catch(() => ({ data: [] })),
        getOvertimeRequests({ year: month.year(), month: month.month() + 1, status: 'APPROVED' }).catch(() => ({ data: [] })),
        getOffsiteRequests({ year: month.year(), month: month.month() + 1, status: 'APPROVED' }).catch(() => ({ data: [] })),
      ]);
      setReportData(res.data);
      // Build leave lookup: { `${employee_id}_${date}` : record }
      const lMap = {};
      for (const rec of (leaveRes.data || [])) {
        lMap[`${rec.employee}_${rec.leave_date}`] = rec;
      }
      setLeaveMap(lMap);
      // Build overtime lookup: { `${employee_id}_${date}` : record }
      const oMap = {};
      for (const rec of (otRes.data || [])) {
        const key = `${rec.employee}_${rec.ot_date}`;
        if (!oMap[key]) oMap[key] = [];
        oMap[key].push(rec);
      }
      setOtMap(oMap);
      // Build offsite lookup: { `${employee_id}_${date}` : record }
      const osMap = {};
      for (const rec of (offsiteRes.data || [])) {
        osMap[`${rec.employee}_${rec.work_date}`] = rec;
      }
      setOffsiteMap(osMap);
    } catch {
      message.error('Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  }, [month, selectedUser, attInfo, canViewAll]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  /* Build lookup: user_id → { 'YYYY-MM-DD': dayObj } */
  const lookup = {};
  if (reportData) {
    for (const emp of reportData.employees) {
      const map = {};
      for (const d of emp.daily) map[d.date] = d;
      lookup[emp.user_id] = { ...emp, dayMap: map };
    }
  }

  const empList = reportData ? reportData.employees : [];

  /* aggregate stats */
  const totalPresent = empList.reduce((s, e) => s + e.summary.present, 0);
  const totalAbsent  = empList.reduce((s, e) => s + e.summary.absent, 0);
  const totalLate    = empList.reduce((s, e) => s + e.summary.late, 0);

  const handlePrint = () => window.print();

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        date_from: month.startOf('month').format('YYYY-MM-DD'),
        date_to:   month.endOf('month').format('YYYY-MM-DD'),
        _page: 'monthly',
      };
      if (canViewAll && selectedUser) params.user_id = selectedUser;
      const res = await exportAttendanceReport(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `BangCong_${month.format('MM_YYYY')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Xuất Excel thành công');
    } catch {
      message.error('Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  /* ── render ──────────────────────────────────────────── */
  return (
    <div>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .monthly-print, .monthly-print * { visibility: visible; }
          .monthly-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .att-table { border-collapse: collapse; width: 100%; font-size: 12px; }
        .att-table th, .att-table td { border: 1px solid #e8e8e8; text-align: center; padding: 0; }
        .att-table th { background: #fafafa; font-weight: 600; position: sticky; top: 0; z-index: 2; }
        .att-table th.day-header { width: 44px; min-width: 44px; padding: 4px 0; font-size: 11px; }
        .att-table th.day-header.weekend { background: #fff1f0; color: #ff4d4f; }
        .att-table td.name-cell { text-align: left; padding: 4px 8px; white-space: nowrap; font-weight: 500;
          position: sticky; left: 0; background: #fff; z-index: 1; min-width: 160px; }
        .att-table td.stt-cell { padding: 4px 6px; position: sticky; left: 0; background: #fff; z-index: 1; width: 40px; }
        .att-table th.name-header { text-align: left; padding: 4px 8px; position: sticky; left: 0; background: #fafafa; z-index: 3; min-width: 160px; }
        .att-table th.stt-header { position: sticky; left: 0; background: #fafafa; z-index: 3; width: 40px; }
        .att-table td.day-cell { padding: 2px; vertical-align: top; height: 52px; width: 44px; cursor: default; }
        .att-table td.day-cell.multi-punch { height: 68px; }
        .att-table td.day-cell.weekend { background: #fffbe6; }
        .att-table td.day-cell.present { background: #f6ffed; }
        .att-table td.day-cell.absent  { background: #fff1f0; }
        .att-table td.day-cell.late    { background: #fff7e6; }
        .att-table td.day-cell.future  { background: #fafafa; }
        .att-table td.summary-cell { padding: 4px 6px; font-weight: 600; }
        .cell-check-in  { color: #389e0d; font-size: 11px; line-height: 1.3; }
        .cell-check-out { color: #cf1322; font-size: 11px; line-height: 1.3; }
        .cell-badge { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 2px; }
        .cell-badge.green  { background: #52c41a; }
        .cell-badge.red    { background: #ff4d4f; }
        .cell-badge.orange { background: #fa8c16; }
        .cell-badge.gray   { background: #d9d9d9; }
        .att-table tr:hover td { background: #e6f7ff !important; }
        .att-table tr:hover td.name-cell,
        .att-table tr:hover td.stt-cell { background: #e6f7ff !important; }
      `}</style>

      {!isMobile && (
        <Title level={4} style={{ marginBottom: 16 }}>
          <CalendarOutlined /> Bảng chấm công tháng
        </Title>
      )}

      {/* ── No mapping alert ── */}
      {attInfo && !canViewAll && !attInfo.attendance_employee_id && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tài khoản của bạn chưa được liên kết với nhân viên chấm công. Hãy liên hệ quản trị viên."
        />
      )}

      {/* ── Filters ── */}
      <Card size="small" style={{ marginBottom: isMobile ? 8 : 16 }} className="no-print att-filter-card">
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 12]} align="middle">
          <Col xs={24} sm="auto">
            {!isMobile && <Text type="secondary" style={{ marginRight: 8 }}>Tháng:</Text>}
            <DatePicker
              picker="month"
              value={month}
              onChange={v => v && setMonth(v.startOf('month'))}
              format="MM/YYYY"
              allowClear={false}
              style={isMobile ? { width: '100%' } : undefined}
              size={isMobile ? 'middle' : undefined}
            />
          </Col>
          {canViewAll && (
            <Col xs={24} sm="auto">
              {!isMobile && <Text type="secondary" style={{ marginRight: 8 }}>Nhân viên:</Text>}
              <Select
                allowClear
                placeholder="Tất cả nhân viên"
                style={{ width: isMobile ? '100%' : 240 }}
                value={selectedUser}
                onChange={setSelectedUser}
                showSearch
                optionFilterProp="label"
                size={isMobile ? 'middle' : undefined}
                options={employees.map(e => ({ value: e.user_id, label: `${e.user_id} - ${e.display_name}` }))}
              />
            </Col>
          )}
          <Col xs={24} sm="auto">
            {isMobile ? (
              <Space style={{ width: '100%' }}>
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport} loading={loading}>
                  Xem
                </Button>
                <Dropdown menu={{ items: [
                  { key: 'print', icon: <PrinterOutlined />, label: 'In', onClick: handlePrint },
                  ...(canViewAll ? [{ key: 'export', icon: <FileExcelOutlined />, label: 'Xuất Excel', onClick: handleExport }] : []),
                ] }} trigger={['click']}>
                  <Button icon={<MoreOutlined />} loading={exporting} />
                </Dropdown>
              </Space>
            ) : (
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport} loading={loading}>
                  Xem
                </Button>
                <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                  In
                </Button>
                {canViewAll && (
                  <Button icon={<FileExcelOutlined />} onClick={handleExport} loading={exporting}
                    style={{ color: '#217346', borderColor: '#217346' }}>
                    Xuất Excel
                  </Button>
                )}
              </Space>
            )}
          </Col>
        </Row>
      </Card>

      {/* ── Stats ── */}
      {reportData && (
        <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 8 : 16 }} className="no-print att-stats-row">
          <Col xs={12} md={4}>
            <Card size="small" className="att-stat-card">
              <Statistic title="Nhân viên" value={empList.length} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small" className="att-stat-card">
              <Statistic title="Đi làm" value={totalPresent}
                valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small" className="att-stat-card">
              <Statistic title="Vắng" value={totalAbsent}
                valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={4}>
            <Card size="small" className="att-stat-card">
              <Statistic title="Đi muộn" value={totalLate}
                valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Tabs: Bảng chấm công + Đi muộn về sớm ── */}
      <Tabs defaultActiveKey="grid" size={isMobile ? 'small' : 'middle'} className="att-tabs" items={[
        {
          key: 'grid',
          label: <span><CalendarOutlined /> {isMobile ? 'Chấm công' : 'Bảng chấm công'}</span>,
          children: (
            <Card
              size="small"
              title={isMobile ? null : (
                <Space wrap>
                  <CalendarOutlined />
                  <span>Bảng chấm công tháng {month.format('MM/YYYY')}</span>
                  <Tag color="green"><span className="cell-badge green" /> Đi làm</Tag>
                  <Tag color="red"><span className="cell-badge red" /> Vắng</Tag>
                  <Tag color="orange"><span className="cell-badge orange" /> Đi muộn</Tag>
                  <Tag color="blue"><span className="cell-badge" style={{ background: '#1677ff', display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }} /> Nghỉ phép (CL)</Tag>
                  <Tag color="orange"><span className="cell-badge" style={{ background: '#d46b08', display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }} /> Nghỉ phép (KL)</Tag>
                  <Tag color="purple"><span className="cell-badge" style={{ background: '#722ed1', display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }} /> Ngoại viện</Tag>
                </Space>
              )}
              styles={{ body: { padding: 0, overflow: 'auto' } }}
            >
              <Spin spinning={loading}>
                {empList.length === 0 && !loading ? (
                  <Empty description="Không có dữ liệu" style={{ padding: 40 }} />
                ) : (
                  <div className="monthly-print" style={{ overflowX: 'auto' }}>
                    <table className="att-table">
                      <thead>
                        <tr>
                          <th className="stt-header" rowSpan={2}>STT</th>
                          <th className="name-header" rowSpan={2}>Họ tên</th>
                          {days.map(d => (
                            <th key={d.day} className={`day-header${d.isWeekend ? ' weekend' : ''}`}>
                              {DAY_LABELS[d.dow]}
                            </th>
                          ))}
                          <th rowSpan={2} style={{ width: 55, padding: '4px 2px', fontSize: 11 }}>Công TT</th>
                          <th rowSpan={2} style={{ width: 55, padding: '4px 2px', fontSize: 11 }}>Công chuẩn</th>
                        </tr>
                        <tr>
                          {days.map(d => (
                            <th key={d.day} className={`day-header${d.isWeekend ? ' weekend' : ''}`}>
                              {d.day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {empList.map((emp, idx) => {
                          const dayMap = lookup[emp.user_id]?.dayMap || {};
                          const today = dayjs().format('YYYY-MM-DD');
                          return (
                            <tr key={emp.user_id}>
                              <td className="stt-cell">{idx + 1}</td>
                              <td className="name-cell">
                                <div style={{ fontSize: 12 }}>{emp.employee_name}</div>
                                {emp.employee_code && <div style={{ fontSize: 10, color: '#1677ff' }}>Mã NV: {emp.employee_code}</div>}
                                {emp.department && <div style={{ fontSize: 10, color: '#888' }}>{emp.department}</div>}
                                {emp.shift && <div style={{ fontSize: 10, color: '#722ed1' }}>{emp.shift.name}</div>}
                                <div style={{ fontSize: 10, color: '#999' }}>{emp.username ? `TK: ${emp.username}` : `ID: ${emp.user_id}`}</div>
                              </td>
                              {days.map(d => {
                                const info = dayMap[d.date];
                                const isFuture = d.date > today;
                                const empProfileId = emp.employee_profile_id;
                                const leaveRec = empProfileId ? leaveMap[`${empProfileId}_${d.date}`] : null;
                                const offsiteRec = empProfileId ? offsiteMap[`${empProfileId}_${d.date}`] : null;

                                // Combined: half-day leave + half-day offsite on the same day
                                if (leaveRec && offsiteRec) {
                                  const leaveMorning  = leaveRec.leave_type   === 'MORNING';
                                  const leaveFullDay  = leaveRec.leave_type   === 'FULL_DAY';
                                  const offsiteMorning = offsiteRec.work_type === 'MORNING';
                                  const isPaid        = leaveRec.paid_type === 'PAID';
                                  const leaveColor    = isPaid ? '#1677ff' : '#d46b08';
                                  const paidLabel     = isPaid ? 'CL' : 'KL';
                                  const leaveSession  = leaveFullDay ? 'cả ngày' : leaveMorning ? 'sáng' : 'chiều';
                                  const offsiteSession = offsiteRec.work_type === 'FULL_DAY' ? 'cả ngày' : offsiteMorning ? 'sáng' : 'chiều';
                                  const tooltipTitle  = `${d.date} — Nghỉ phép buổi ${leaveSession} (${isPaid ? 'Có lương' : 'Không lương'}) + Ngoại viện buổi ${offsiteSession}`;
                                  // Put morning block first, afternoon block second
                                  const leaveFirst = leaveFullDay || leaveMorning || !offsiteMorning;
                                  const topSection    = leaveFirst
                                    ? { color: leaveColor,  label: `Nghỉ ${leaveSession}`,   sub: paidLabel }
                                    : { color: '#722ed1',   label: `NV ${offsiteSession}`,    sub: '' };
                                  const bottomSection = leaveFirst
                                    ? { color: '#722ed1',   label: `NV ${offsiteSession}`,    sub: '' }
                                    : { color: leaveColor,  label: `Nghỉ ${leaveSession}`,    sub: paidLabel };
                                  return (
                                    <Tooltip key={d.day} title={tooltipTitle}>
                                      <td className="day-cell" style={{ background: '#fafafa', textAlign: 'center', padding: '2px' }}>
                                        <div style={{ borderBottom: '1px dashed #d9d9d9', paddingBottom: 2, marginBottom: 2 }}>
                                          <span className="cell-badge" style={{ background: topSection.color }} />
                                          <div style={{ color: topSection.color, fontSize: 9, fontWeight: 600 }}>{topSection.label}</div>
                                          {topSection.sub && <div style={{ color: topSection.color, fontSize: 8 }}>{topSection.sub}</div>}
                                        </div>
                                        <div>
                                          <span className="cell-badge" style={{ background: bottomSection.color }} />
                                          <div style={{ color: bottomSection.color, fontSize: 9, fontWeight: 600 }}>{bottomSection.label}</div>
                                          {bottomSection.sub && <div style={{ color: bottomSection.color, fontSize: 8 }}>{bottomSection.sub}</div>}
                                        </div>
                                      </td>
                                    </Tooltip>
                                  );
                                }

                                // Leave day takes priority over future-date gray dot
                                if (leaveRec) {
                                  const isFullDay = leaveRec.leave_type === 'FULL_DAY';
                                  const isMorning = leaveRec.leave_type === 'MORNING';
                                  const isPaid = leaveRec.paid_type === 'PAID';
                                  const paidLabel = isPaid ? 'Có lương' : 'Không lương';
                                  const sessionLabel = isFullDay ? 'Cả ngày' : isMorning ? 'Buổi sáng' : 'Buổi chiều';
                                  const tooltipTitle = `${d.date} — Nghỉ phép ${sessionLabel} (${paidLabel})`;
                                  // Paid = blue, Unpaid = orange
                                  const color = isPaid ? '#1677ff' : '#d46b08';
                                  const bgColor = isPaid ? '#e6f4ff' : '#fff7e6';
                                  const dividerColor = isPaid ? '#91caff' : '#ffd591';

                                  if (isFullDay) {
                                    return (
                                      <Tooltip key={d.day} title={tooltipTitle}>
                                        <td className="day-cell" style={{ background: bgColor, textAlign: 'center' }}>
                                          <span className="cell-badge" style={{ background: color }} />
                                          <div style={{ color, fontSize: 10, fontWeight: 600 }}>Nghỉ phép</div>
                                          <div style={{ color, fontSize: 9 }}>{isPaid ? 'Có lương' : 'Không lương'}</div>
                                        </td>
                                      </Tooltip>
                                    );
                                  }
                                  // Half-day leave: show leave section + attendance for working half
                                  const halfInfo = info;
                                  const halfPunches = halfInfo ? filterPunches(halfInfo.punches || [], emp.shift) : [];
                                  const halfCheckIn = halfPunches[0] || halfInfo?.check_in;
                                  const halfCheckOut = halfPunches.length > 1 ? halfPunches[halfPunches.length - 1] : halfInfo?.check_out;
                                  return (
                                    <Tooltip key={d.day} title={tooltipTitle}>
                                      <td className="day-cell" style={{ background: bgColor, textAlign: 'center', padding: '2px' }}>
                                        <div style={{ borderBottom: `1px dashed ${dividerColor}`, paddingBottom: 2, marginBottom: 2 }}>
                                          <span className="cell-badge" style={{ background: color }} />
                                          <div style={{ color, fontSize: 9, fontWeight: 600 }}>Nghỉ {isMorning ? 'sáng' : 'chiều'}</div>
                                          <div style={{ color, fontSize: 8 }}>{isPaid ? 'CL' : 'KL'}</div>
                                        </div>
                                        {(halfCheckIn || halfCheckOut) && (
                                          <div style={{ fontSize: 9, color: '#555', lineHeight: 1.3 }}>
                                            {halfCheckIn && <div>{halfCheckIn}</div>}
                                            {halfCheckOut && <div>{halfCheckOut}</div>}
                                          </div>
                                        )}
                                      </td>
                                    </Tooltip>
                                  );
                                }

                                // Offsite work day: purple badge
                                if (offsiteRec) {
                                  const isFullDay = offsiteRec.work_type === 'FULL_DAY';
                                  const isMorning = offsiteRec.work_type === 'MORNING';
                                  const sessionLabel = isFullDay ? 'Cả ngày' : isMorning ? 'Buổi sáng' : 'Buổi chiều';
                                  const tooltipTitle = `${d.date} — Ngoại viện ${sessionLabel}${offsiteRec.location ? ` — ${offsiteRec.location}` : ''}`;

                                  if (isFullDay) {
                                    return (
                                      <Tooltip key={d.day} title={tooltipTitle}>
                                        <td className="day-cell" style={{ background: '#f9f0ff', textAlign: 'center' }}>
                                          <span className="cell-badge" style={{ background: '#722ed1' }} />
                                          <div style={{ color: '#722ed1', fontSize: 10, fontWeight: 600 }}>Ngoại viện</div>
                                          <div style={{ color: '#722ed1', fontSize: 9 }}>Cả ngày</div>
                                        </td>
                                      </Tooltip>
                                    );
                                  }
                                  // Half-day offsite: show offsite section + attendance for working half
                                  const halfInfo = info;
                                  const halfPunches = halfInfo ? filterPunches(halfInfo.punches || [], emp.shift) : [];
                                  const halfCheckIn = halfPunches[0] || halfInfo?.check_in;
                                  const halfCheckOut = halfPunches.length > 1 ? halfPunches[halfPunches.length - 1] : halfInfo?.check_out;
                                  return (
                                    <Tooltip key={d.day} title={tooltipTitle}>
                                      <td className="day-cell" style={{ background: '#f9f0ff', textAlign: 'center', padding: '2px' }}>
                                        <div style={{ borderBottom: '1px dashed #d3adf7', paddingBottom: 2, marginBottom: 2 }}>
                                          <span className="cell-badge" style={{ background: '#722ed1' }} />
                                          <div style={{ color: '#722ed1', fontSize: 9, fontWeight: 600 }}>NV {isMorning ? 'sáng' : 'chiều'}</div>
                                        </div>
                                        {(halfCheckIn || halfCheckOut) && (
                                          <div style={{ fontSize: 9, color: '#555', lineHeight: 1.3 }}>
                                            {halfCheckIn && <div>{halfCheckIn}</div>}
                                            {halfCheckOut && <div>{halfCheckOut}</div>}
                                          </div>
                                        )}
                                      </td>
                                    </Tooltip>
                                  );
                                }

                                if (isFuture) {
                                  return (
                                    <td key={d.day} className="day-cell future">
                                      <span className="cell-badge gray" />
                                    </td>
                                  );
                                }

                                if (!info || info.status === 'absent') {
                                  if (d.isWeekend) {
                                    return (
                                      <td key={d.day} className="day-cell weekend">
                                        <span style={{ color: '#bbb', fontSize: 10 }}>—</span>
                                      </td>
                                    );
                                  }
                                  return (
                                    <Tooltip key={d.day} title={`${d.date} — Vắng mặt`}>
                                      <td className="day-cell absent">
                                        <span className="cell-badge red" />
                                        <div style={{ color: '#ff4d4f', fontSize: 10, fontWeight: 600 }}>Vắng</div>
                                      </td>
                                    </Tooltip>
                                  );
                                }

                                const isLate = info.status === 'late' || info.status === 'late+early';
                                const cellClass = isLate ? 'late' : 'present';
                                const rawPunches = info.punches || [];
                                const punches = filterPunches(rawPunches, emp.shift);
                                const isMulti = punches.length > 2;

                                return (
                                  <Tooltip
                                    key={d.day}
                                    title={
                                      <div style={{ fontSize: 12 }}>
                                        <div><b>{dayjs(d.date).format('DD/MM/YYYY')}</b></div>
                                        {punches.length > 0 ? punches.map((p, i) => (
                                          <div key={i}>Lần {i + 1}: <b>{p}</b></div>
                                        )) : (
                                          <>
                                            <div>Vào: <b>{info.check_in || '—'}</b></div>
                                            <div>Ra: <b>{info.check_out || '—'}</b></div>
                                          </>
                                        )}
                                        {rawPunches.length > punches.length && (
                                          <div style={{ color: '#999', fontSize: 11 }}>({rawPunches.length} lần chấm, hiển thị {punches.length})</div>
                                        )}
                                        {info.late_minutes > 0 && <div style={{ color: '#faad14' }}>Muộn: {info.late_minutes} phút{info.late_label ? ` (${info.late_label})` : ''}</div>}
                                        {info.early_minutes > 0 && <div style={{ color: '#1890ff' }}>Sớm: {info.early_minutes} phút{info.early_label ? ` (${info.early_label})` : ''}</div>}
                                        {info.ot_minutes > 0 && <div style={{ color: '#722ed1' }}>OT: {info.ot_minutes} phút</div>}
                                        {info.work_minutes > 0 && <div>Làm: {Math.floor(info.work_minutes / 60)}h{info.work_minutes % 60}p</div>}
                                      </div>
                                    }
                                  >
                                    <td className={`day-cell ${cellClass}${isMulti ? ' multi-punch' : ''}`}>
                                      <span className={`cell-badge ${isLate ? 'orange' : 'green'}`} />
                                      {isMulti ? (
                                        punches.map((p, i) => (
                                          <div key={i} style={{ color: i % 2 === 0 ? '#389e0d' : '#cf1322', fontSize: 10, lineHeight: 1.2 }}>{p.slice(0, 5)}</div>
                                        ))
                                      ) : (
                                        <>
                                          <div className="cell-check-in">{(punches[0] || info.check_in || '—').slice(0, 5)}</div>
                                          <div className="cell-check-out">{(punches[1] || info.check_out || '—').slice(0, 5)}</div>
                                        </>
                                      )}
                                    </td>
                                  </Tooltip>
                                );
                              })}
                              {(() => {
                                const epId = emp.employee_profile_id;
                                let actualDays = 0;
                                for (const d of days) {
                                  const info = dayMap[d.date];
                                  const lr = epId ? leaveMap[`${epId}_${d.date}`] : null;
                                  const os = epId ? offsiteMap[`${epId}_${d.date}`] : null;
                                  actualDays += calcWorkDay(info, lr, os);
                                }
                                const stdDays = calcStandardDays(days);
                                return (
                                  <>
                                    <td className="summary-cell" style={{ color: '#52c41a' }}>{actualDays % 1 === 0 ? actualDays : actualDays.toFixed(1)}</td>
                                    <td className="summary-cell" style={{ color: '#1677ff' }}>{stdDays}</td>
                                  </>
                                );
                              })()}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Spin>
            </Card>
          ),
        },
        {
          key: 'late-early',
          label: <span><WarningOutlined /> Đi muộn về sớm</span>,
          children: (() => {
            // Build late/early detail data from report
            const lateEarlyData = [];
            for (const emp of empList) {
              for (const d of emp.daily) {
                if (d.late_minutes > 0 || d.early_minutes > 0) {
                  const punches = d.punches || [];
                  lateEarlyData.push({
                    key: `${emp.user_id}_${d.date}`,
                    user_id: emp.user_id,
                    username: emp.username,
                    employee_name: emp.employee_name,
                    department: emp.department,
                    shift_name: emp.shift?.name || '',
                    date: d.date,
                    late_minutes: d.late_minutes,
                    late_label: d.late_label || '',
                    early_minutes: d.early_minutes,
                    early_label: d.early_label || '',
                    check_in: punches[0] || d.check_in,
                    check_out: punches.length > 1 ? punches[punches.length - 1] : d.check_out,
                  });
                }
              }
            }

            const leCols = [
              { title: 'Mã NV', width: 100, render: (_, r) => r.username || r.user_id },
              { title: 'Họ tên', dataIndex: 'employee_name', width: 160 },
              { title: 'Phòng ban', dataIndex: 'department', width: 120 },
              { title: 'Ca', dataIndex: 'shift_name', width: 120 },
              { title: 'Ngày', dataIndex: 'date', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
              { title: 'Check-in', dataIndex: 'check_in', width: 90, align: 'center', render: v => v || '—' },
              { title: 'Check-out', dataIndex: 'check_out', width: 90, align: 'center', render: v => v || '—' },
              {
                title: 'Đi muộn', width: 120, align: 'center',
                render: (_, r) => r.late_minutes > 0
                  ? <Tooltip title={r.late_label}><Tag color="orange">{r.late_minutes} phút</Tag></Tooltip>
                  : '—',
              },
              {
                title: 'Về sớm', width: 120, align: 'center',
                render: (_, r) => r.early_minutes > 0
                  ? <Tooltip title={r.early_label}><Tag color="blue">{r.early_minutes} phút</Tag></Tooltip>
                  : '—',
              },
            ];

            // Build penalty summary
            const penaltySummary = empList
              .filter(e => e.summary.total_penalty > 0 || e.summary.late > 0 || e.summary.early_leave > 0)
              .map(e => ({
                key: e.user_id,
                user_id: e.user_id,
                username: e.username,
                employee_name: e.employee_name,
                department: e.department,
                shift_name: e.shift?.name || '',
                late_count: e.summary.late,
                late_minutes: e.summary.late_minutes || 0,
                late_penalty: e.summary.late_penalty || 0,
                early_count: e.summary.early_leave,
                early_minutes: e.summary.early_minutes || 0,
                early_penalty: e.summary.early_penalty || 0,
                total_penalty: e.summary.total_penalty || 0,
              }));

            const penCols = [
              { title: 'Mã NV', width: 100, render: (_, r) => r.username || r.user_id },
              { title: 'Họ tên', dataIndex: 'employee_name', width: 160 },
              { title: 'Ca', dataIndex: 'shift_name', width: 120 },
              { title: 'Số lần muộn', dataIndex: 'late_count', width: 100, align: 'center',
                render: v => v > 0 ? <Tag color="orange">{v} lần</Tag> : '0' },
              { title: 'Tổng phút muộn', dataIndex: 'late_minutes', width: 110, align: 'center',
                render: v => v > 0 ? `${v} phút` : '—' },
              { title: 'Phạt muộn', width: 150, align: 'right',
                render: (_, r) => r.late_penalty > 0
                  ? <Text type="danger">{r.late_penalty.toLocaleString('vi-VN')}₫</Text>
                  : '—' },
              { title: 'Số lần sớm', dataIndex: 'early_count', width: 100, align: 'center',
                render: v => v > 0 ? <Tag color="blue">{v} lần</Tag> : '0' },
              { title: 'Tổng phút sớm', dataIndex: 'early_minutes', width: 110, align: 'center',
                render: v => v > 0 ? `${v} phút` : '—' },
              { title: 'Phạt sớm', width: 150, align: 'right',
                render: (_, r) => r.early_penalty > 0
                  ? <Text type="danger">{r.early_penalty.toLocaleString('vi-VN')}₫</Text>
                  : '—' },
              { title: 'Tổng phạt', dataIndex: 'total_penalty', width: 140, align: 'right',
                render: v => v > 0 ? <Text strong type="danger">{v.toLocaleString('vi-VN')}₫</Text> : '—' },
            ];

            return (
              <div>
                <Card size="small" title={<span><WarningOutlined style={{ color: '#fa8c16' }} /> Chi tiết đi muộn / về sớm</span>}
                  style={{ marginBottom: 16 }}>
                  <Table dataSource={lateEarlyData} columns={leCols} size="small" bordered
                    pagination={{ defaultPageSize: 50, showSizeChanger: true, showTotal: t => `${t} dòng` }}
                    scroll={{ x: 1000 }} />
                </Card>
                {penaltySummary.length > 0 && (
                  <Card size="small" title={<span><DollarOutlined style={{ color: '#722ed1' }} /> Tổng hợp phạt tháng {month.format('MM/YYYY')}</span>}>
                    <Table dataSource={penaltySummary} columns={penCols} size="small" bordered
                      pagination={false} scroll={{ x: 1100 }} />
                  </Card>
                )}
              </div>
            );
          })(),
        },
        {
          key: 'overtime',
          label: <span><CalendarOutlined /> Giờ làm thêm</span>,
          children: (() => {
            // Build OT detail data from otMap
            const otData = [];
            const empOtSummary = {};
            for (const emp of empList) {
              const epId = emp.employee_profile_id;
              if (!epId) continue;
              let totalHours = 0;
              for (const d of days) {
                const recs = otMap[`${epId}_${d.date}`];
                if (recs) {
                  for (const rec of recs) {
                    const hours = parseFloat(rec.ot_hours) || 0;
                    totalHours += hours;
                    otData.push({
                      key: `${rec.id}`,
                      employee_name: emp.employee_name,
                      username: emp.username || emp.user_id,
                      department: emp.department,
                      date: rec.ot_date,
                      start_time: rec.start_time,
                      end_time: rec.end_time,
                      ot_hours: hours,
                      reason: rec.reason,
                    });
                  }
                }
              }
              if (totalHours > 0) {
                empOtSummary[epId] = {
                  key: epId,
                  employee_name: emp.employee_name,
                  username: emp.username || emp.user_id,
                  department: emp.department,
                  total_hours: Math.round(totalHours * 10) / 10,
                };
              }
            }

            const otCols = [
              { title: 'Mã NV', dataIndex: 'username', width: 100 },
              { title: 'Họ tên', dataIndex: 'employee_name', width: 160 },
              { title: 'Phòng ban', dataIndex: 'department', width: 120 },
              { title: 'Ngày', dataIndex: 'date', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
              { title: 'Bắt đầu', dataIndex: 'start_time', width: 90, align: 'center' },
              { title: 'Kết thúc', dataIndex: 'end_time', width: 90, align: 'center' },
              { title: 'Số giờ', dataIndex: 'ot_hours', width: 90, align: 'center',
                render: v => <Tag color="blue">{v}h</Tag> },
              { title: 'Lý do', dataIndex: 'reason', width: 200 },
            ];

            const summaryCols = [
              { title: 'Mã NV', dataIndex: 'username', width: 100 },
              { title: 'Họ tên', dataIndex: 'employee_name', width: 160 },
              { title: 'Phòng ban', dataIndex: 'department', width: 120 },
              { title: 'Tổng giờ làm thêm', dataIndex: 'total_hours', width: 150, align: 'center',
                render: v => <Tag color="blue">{v} giờ</Tag> },
            ];

            const summaryList = Object.values(empOtSummary);
            const grandTotal = summaryList.reduce((s, e) => s + e.total_hours, 0);

            return (
              <div>
                {summaryList.length > 0 && (
                  <Card size="small" title={
                    <Space>
                      <CalendarOutlined style={{ color: '#1677ff' }} />
                      <span>Tổng hợp giờ làm thêm tháng {month.format('MM/YYYY')}</span>
                      <Tag color="blue">Tổng: {Math.round(grandTotal * 10) / 10} giờ</Tag>
                    </Space>
                  } style={{ marginBottom: 16 }}>
                    <Table dataSource={summaryList} columns={summaryCols} size="small" bordered
                      pagination={false} scroll={{ x: 500 }} />
                  </Card>
                )}
                <Card size="small" title={<span><CalendarOutlined style={{ color: '#1677ff' }} /> Chi tiết giờ làm thêm</span>}>
                  {otData.length === 0
                    ? <Empty description="Không có dữ liệu làm thêm trong tháng này" />
                    : <Table dataSource={otData} columns={otCols} size="small" bordered
                        pagination={{ defaultPageSize: 50, showSizeChanger: true, showTotal: t => `${t} dòng` }}
                        scroll={{ x: 900 }} />
                  }
                </Card>
              </div>
            );
          })(),
        },
      ]} />
    </div>
  );
}
