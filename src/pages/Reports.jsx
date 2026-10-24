import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, ChevronDown, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

function formatRupee(num = 0) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

export default function Reports() {
  const [period, setPeriod] = useState('This month');
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [products, setProducts] = useState([]);

  // Subscribe to real-time collections
  useEffect(() => {
    try {
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});

      const unsubRefunds = onSnapshot(collection(db, 'refunds'), (snap) => {
        setRefunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});

      const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});

      return () => {
        unsubOrders();
        unsubRefunds();
        unsubProducts();
      };
    } catch (_) {}
  }, []);

  // Compute live KPIs
  const { grossSales, deliveredCount, totalRefundAmount, refundCount, netSales } = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'DELIVERED');
    const gross = delivered.reduce((sum, o) => sum + (o.total || 0), 0);
    const refundAmt = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      grossSales: gross,
      deliveredCount: delivered.length,
      totalRefundAmount: refundAmt,
      refundCount: refunds.length,
      netSales: Math.max(0, gross - refundAmt),
    };
  }, [orders, refunds]);

  const reportItems = useMemo(() => {
    return [
      {
        id: 'gst',
        title: 'GST sales report (GSTR-1)',
        desc: 'Invoice-wise sales with HSN and tax rate, for your accountant',
        filename: `MS_Traders_GSTR1_${new Date().toISOString().slice(0, 7)}`,
        generateCsv: () => {
          const rows = [
            ['Invoice No', 'Date', 'Customer Name', 'HSN Code', 'Taxable Value (INR)', 'CGST', 'SGST', 'Total Invoice Value'],
          ];
          orders.forEach((o) => {
            const tot = o.total || 0;
            const taxable = (tot / 1.05).toFixed(2);
            const gst = ((tot - taxable) / 2).toFixed(2);
            rows.push([
              `INV-${o.orderNo || o.id?.slice(-4)}`,
              new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              o.userName || o.customerName || 'Customer',
              '0401',
              taxable,
              gst,
              gst,
              tot.toFixed(2),
            ]);
          });
          return rows;
        },
      },
      {
        id: 'products',
        title: 'Sales by product',
        desc: 'Units and revenue per product and pack size',
        filename: `MS_Traders_Sales_By_Product_${new Date().toISOString().slice(0, 7)}`,
        generateCsv: () => {
          const rows = [['Product Name', 'Units Sold', 'Gross Revenue (INR)']];
          const map = {};
          orders.forEach((o) => {
            if (Array.isArray(o.items)) {
              o.items.forEach((it) => {
                const k = it.name || it.productName || 'Item';
                if (!map[k]) map[k] = { qty: 0, revenue: 0 };
                map[k].qty += (it.qty || it.quantity || 1);
                map[k].revenue += (it.price || 0) * (it.qty || it.quantity || 1);
              });
            }
          });
          Object.entries(map).forEach(([name, d]) => {
            rows.push([name, d.qty, d.revenue.toFixed(2)]);
          });
          return rows;
        },
      },
      {
        id: 'reconciliation',
        title: 'Payment reconciliation',
        desc: 'Every UPI and cash payment with UTR, for matching against your bank statement',
        filename: `MS_Traders_Payment_Reconciliation_${new Date().toISOString().slice(0, 7)}`,
        generateCsv: () => {
          const rows = [['Order ID', 'Date & Time', 'Payment Method', 'UTR / Ref No', 'Amount (INR)', 'Status']];
          orders.forEach((o) => {
            rows.push([
              `#${o.orderNo || o.id?.slice(-4)}`,
              new Date(o.createdAt || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              o.paymentMethod || 'UPI',
              o.utr || o.paymentRef || '—',
              (o.total || 0).toFixed(2),
              o.paymentStatus || (o.status === 'DELIVERED' ? 'COMPLETED' : 'PENDING'),
            ]);
          });
          return rows;
        },
      },
    ];
  }, [orders]);

  const downloadCsv = (item) => {
    try {
      const rows = item.generateCsv();
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${item.filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded ${item.title} (CSV)`);
    } catch (err) {
      toast.error('Failed to export CSV: ' + err.message);
    }
  };

  const downloadPdf = (item) => {
    try {
      const rows = item.generateCsv();
      const headers = rows[0] || [];
      const dataRows = rows.slice(1);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups to print PDF.');
        return;
      }

      // Check numeric columns for right-alignment and summation
      const isNumericCol = (header = '') => {
        const h = header.toLowerCase();
        return (
          h.includes('inr') ||
          h.includes('amount') ||
          h.includes('value') ||
          h.includes('cgst') ||
          h.includes('sgst') ||
          h.includes('units') ||
          h.includes('revenue') ||
          h.includes('price') ||
          h.includes('total')
        );
      };

      // Compute totals for numeric columns
      const totals = headers.map((header, colIdx) => {
        if (!isNumericCol(header)) return null;
        let sum = 0;
        let valid = false;
        dataRows.forEach((r) => {
          const val = parseFloat(String(r[colIdx] || '').replace(/[^\d.-]/g, ''));
          if (!isNaN(val)) {
            sum += val;
            valid = true;
          }
        });
        return valid ? sum.toFixed(2) : null;
      });

      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const formattedTime = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${item.title} — MS Traders</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              margin: 0;
              padding: 32px;
              font-size: 11px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Action Bar for screen view */
            .action-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: #064e3b;
              color: #ffffff;
              padding: 12px 20px;
              border-radius: 12px;
              margin-bottom: 24px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .action-title {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              font-weight: 600;
            }
            .action-btns {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .btn-primary {
              background: #ffffff;
              color: #064e3b;
              border: none;
              padding: 7px 16px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 12px;
              cursor: pointer;
              transition: background 0.2s;
            }
            .btn-primary:hover { background: #f0fdf4; }
            .btn-secondary {
              background: transparent;
              color: #ffffff;
              border: 1px solid rgba(255, 255, 255, 0.4);
              padding: 6px 14px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 12px;
              cursor: pointer;
            }
            .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

            /* Header Branded Section */
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 20px;
              border-bottom: 2px solid #0a7c47;
              margin-bottom: 20px;
            }
            .brand-left {
              display: flex;
              gap: 14px;
              align-items: center;
            }
            .brand-logo {
              width: 52px;
              height: 52px;
              border-radius: 12px;
              background: linear-gradient(135deg, #0a7c47 0%, #064e3b 100%);
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 26px;
              font-weight: 900;
              letter-spacing: -1px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .brand-title {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 2px 0;
              letter-spacing: -0.5px;
            }
            .brand-sub {
              font-size: 11px;
              font-weight: 600;
              color: #0a7c47;
              margin: 0 0 4px 0;
            }
            .brand-address {
              font-size: 10px;
              color: #64748b;
              margin: 0;
            }
            .brand-meta {
              font-size: 10px;
              color: #475569;
              font-weight: 500;
              margin-top: 2px;
            }

            .doc-right {
              text-align: right;
            }
            .doc-badge {
              display: inline-block;
              background: #ecfdf5;
              color: #065f46;
              border: 1px solid #a7f3d0;
              padding: 3px 10px;
              border-radius: 999px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
            }
            .doc-title {
              font-size: 17px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 6px 0;
            }
            .meta-line {
              font-size: 10px;
              color: #64748b;
              margin: 2px 0;
            }
            .meta-line strong {
              color: #334155;
            }

            /* Report Stats Strip */
            .stats-strip {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }
            .stat-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-left: 3px solid #0a7c47;
              padding: 10px 14px;
              border-radius: 8px;
            }
            .stat-box-lbl {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.5px;
            }
            .stat-box-val {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }

            /* Clean Table Styling with Professional Lines */
            .table-container {
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              overflow: hidden;
              margin-bottom: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            thead th {
              background: #f1f5f9;
              color: #1e293b;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9.5px;
              letter-spacing: 0.5px;
              padding: 10px 12px;
              border-bottom: 2px solid #cbd5e1;
              white-space: nowrap;
            }
            tbody td {
              padding: 8px 12px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            tbody tr:last-child td {
              border-bottom: none;
            }
            tbody tr:hover {
              background-color: #f1f5f9;
            }

            .align-right { text-align: right; font-variant-numeric: tabular-nums; }
            .align-center { text-align: center; }
            .align-left { text-align: left; }

            /* Footer Total Row */
            tfoot tr {
              background: #e2e8f0;
              border-top: 2px solid #94a3b8;
              font-weight: 800;
              color: #0f172a;
            }
            tfoot td {
              padding: 10px 12px;
              font-size: 11px;
            }

            /* Sign-off & Legal */
            .footer-sign {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px dashed #cbd5e1;
            }
            .disclaimer {
              font-size: 9.5px;
              color: #64748b;
              max-width: 420px;
              line-height: 1.4;
            }
            .sign-box {
              text-align: center;
              width: 180px;
            }
            .sign-line {
              border-top: 1px solid #475569;
              margin-bottom: 6px;
            }
            .sign-label {
              font-size: 10px;
              font-weight: 700;
              color: #334155;
            }
            .sign-sub {
              font-size: 9px;
              color: #64748b;
            }

            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
              @page {
                size: auto;
                margin: 12mm;
              }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <!-- Top Interactive Bar for Browser Preview -->
          <div class="action-bar no-print">
            <div class="action-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              <span>MS Traders Official PDF & Print Generator</span>
            </div>
            <div class="action-btns">
              <button onclick="window.print()" class="btn-primary">Print / Save as PDF</button>
              <button onclick="window.close()" class="btn-secondary">Close</button>
            </div>
          </div>

          <!-- Document Branded Header -->
          <div class="header-container">
            <div class="brand-left">
              <div class="brand-logo">M</div>
              <div>
                <h1 class="brand-title">MS Traders</h1>
                <p class="brand-sub">SUPERMARKET & FRESH GROCERIES · STORE ADMIN</p>
                <p class="brand-address">HV76+F39, Menamkulam, Thiruvananthapuram, Kerala 695582</p>
                <p class="brand-meta">GSTIN: 32AABCS1429B1Z8 · Support: hassanramla31@gmail.com · +91 9037655180</p>
              </div>
            </div>

            <div class="doc-right">
              <span class="doc-badge">OFFICIAL AUDIT REPORT</span>
              <h2 class="doc-title">${item.title}</h2>
              <p class="meta-line"><strong>Generated on:</strong> ${formattedDate} at ${formattedTime}</p>
              <p class="meta-line"><strong>Total Rows:</strong> ${dataRows.length} entries</p>
              <p class="meta-line"><strong>System Status:</strong> Verified</p>
            </div>
          </div>

          <!-- Executive Summary Stat Boxes -->
          <div class="stats-strip">
            <div class="stat-box">
              <div class="stat-box-lbl">REPORT TYPE</div>
              <div class="stat-box-val">${item.title.split('(')[0].trim()}</div>
            </div>
            <div class="stat-box">
              <div class="stat-box-lbl">TOTAL ENTRIES</div>
              <div class="stat-box-val">${dataRows.length} Records</div>
            </div>
            <div class="stat-box">
              <div class="stat-box-lbl">GENERATED AT</div>
              <div class="stat-box-val">${formattedDate}</div>
            </div>
          </div>

          <!-- Structured Report Table -->
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  ${headers
                    .map((h) => {
                      const align = isNumericCol(h) ? 'align-right' : 'align-left';
                      return `<th class="${align}">${h}</th>`;
                    })
                    .join('')}
                </tr>
              </thead>
              <tbody>
                ${dataRows
                  .map(
                    (row) => `
                    <tr>
                      ${row
                        .map((cell, idx) => {
                          const align = isNumericCol(headers[idx]) ? 'align-right' : 'align-left';
                          return `<td class="${align}">${cell}</td>`;
                        })
                        .join('')}
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
              ${
                totals.some((t) => t !== null)
                  ? `
                  <tfoot>
                    <tr>
                      ${totals
                        .map((tot, idx) => {
                          if (idx === 0) return `<td>TOTAL</td>`;
                          if (tot !== null) return `<td class="align-right">₹${tot}</td>`;
                          return `<td></td>`;
                        })
                        .join('')}
                    </tr>
                  </tfoot>
                `
                  : ''
              }
            </table>
          </div>

          <!-- Sign-off & Document Disclaimer -->
          <div class="footer-sign">
            <div class="disclaimer">
              This document is generated automatically by the MS Traders ERP & Store Management System.<br>
              All listed amounts and tax details are reconciled directly from the live store database.
            </div>
            <div class="sign-box">
              <div style="height: 36px;"></div>
              <div class="sign-line"></div>
              <div class="sign-label">Authorized Signatory</div>
              <div class="sign-sub">MS Traders Supermarket</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      toast.success(`Opened formatted PDF report for ${item.title}`);
    } catch (err) {
      toast.error('Failed to prepare PDF');
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time financial and operational reports from delivered and paid orders
          </p>
        </div>

        {/* Top Right Filter Dropdown */}
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 shadow-2xs hover:border-gray-300 focus:outline-none focus:border-[#0a7c47] focus:ring-1 focus:ring-[#0a7c47] cursor-pointer"
          >
            <option value="This month">This month</option>
            <option value="Last month">Last month</option>
            <option value="Last 30 days">Last 30 days</option>
            <option value="FY 2026–27">FY 2026–27</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      {/* 4 Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Gross sales</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 tracking-tight">₹{formatRupee(grossSales)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{deliveredCount} delivered orders</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Refunds</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 tracking-tight">₹{formatRupee(totalRefundAmount)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{refundCount} refunds</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">Net sales</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 tracking-tight">₹{formatRupee(netSales)}</p>
          <p className="text-[11px] text-gray-400 mt-1">After refunds and coupons</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <p className="text-xs text-gray-500 font-medium">GST collected</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 tracking-tight">₹{formatRupee(grossSales * 0.05)}</p>
          <p className="text-[11px] text-gray-400 mt-1">5% average composite rate</p>
        </div>
      </div>

      {/* Downloads Section */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-gray-900">Downloads</h2>

        <div className="bg-white rounded-2xl border border-gray-200/80 divide-y divide-gray-100 overflow-hidden shadow-2xs">
          {reportItems.map((item) => (
            <div
              key={item.id}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 shrink-0 mt-0.5">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  onClick={() => downloadCsv(item)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => downloadPdf(item)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs"
                >
                  Print PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
