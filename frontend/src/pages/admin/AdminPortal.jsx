import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Users,
  Building2,
  Activity,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  RotateCcw,
  Save,
  Ban,
  Check,
  KeyRound,
} from "lucide-react";
import { getErrorMessage } from "../../api/client";
import {
  getAdminAiLogs,
  getAdminOverview,
  getAdminPrompts,
  getAdminSupportGrants,
  getAdminUsers,
  getCompaniesReview,
  resetAdminPrompt,
  revokeAdminSupportGrant,
  updateAdminPrompt,
  updateAdminUserSuspension,
  updateCompanyReviewStatus,
} from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";

const TABS = [
  { id: "overview", label: "النظرة العامة والتحليلات", Icon: Activity },
  { id: "governance", label: "الشركات والمستخدمون", Icon: Building2 },
  { id: "ai-logs", label: "مراقبة الذكاء الاصطناعي", Icon: Sparkles },
  { id: "prompts", label: "قوالب الأوامر (Prompts)", Icon: ShieldCheck },
];

export default function AdminPortal() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const [overview, setOverview] = useState(null);
  const [companiesQueue, setCompaniesQueue] = useState({ pending: [], approved: [], rejected: [] });
  const [usersData, setUsersData] = useState({ total: 0, users: [] });
  const [userSearch, setUserSearch] = useState("");
  const [grantsData, setGrantsData] = useState({ total: 0, grants: [] });
  const [aiLogsData, setAiLogsData] = useState({ total: 0, logs: [], summary: null, ollama: null });
  const [logTaskFilter, setLogTaskFilter] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [promptDrafts, setPromptDrafts] = useState({});

  const loadAll = async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const [ovRes, compRes, usrRes, grantsRes, logsRes, prRes] = await Promise.all([
        getAdminOverview(),
        getCompaniesReview(),
        getAdminUsers({ limit: 50 }),
        getAdminSupportGrants({ limit: 50 }),
        getAdminAiLogs({ limit: 40 }),
        getAdminPrompts(),
      ]);
      setOverview(ovRes.data);
      setCompaniesQueue(compRes.data || { pending: [], approved: [], rejected: [] });
      setUsersData(usrRes.data || { total: 0, users: [] });
      setGrantsData(grantsRes.data || { total: 0, grants: [] });
      setAiLogsData(logsRes.data || { total: 0, logs: [] });
      const list = prRes.data?.prompts || [];
      setPrompts(list);
      const drafts = {};
      list.forEach((p) => {
        drafts[p.key] = p.system_prompt;
      });
      setPromptDrafts(drafts);
    } catch (err) {
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        showToast(getErrorMessage(err, "تعذر تحميل بيانات بوابة مدير النظام"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshUsers = async (queryText = userSearch) => {
    try {
      const res = await getAdminUsers({ q: queryText.trim() || undefined, limit: 50 });
      setUsersData(res.data || { total: 0, users: [] });
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تحديث قائمة المستخدمين"), "error");
    }
  };

  const refreshAiLogs = async (taskName = logTaskFilter) => {
    try {
      const res = await getAdminAiLogs({ task: taskName || undefined, limit: 50 });
      setAiLogsData(res.data || { total: 0, logs: [] });
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تحديث سجلات الذكاء الاصطناعي"), "error");
    }
  };

  const handleCompanyDecision = async (companyId, status) => {
    setBusyKey(`company-${companyId}`);
    try {
      await updateCompanyReviewStatus(companyId, status);
      const [compRes, ovRes] = await Promise.all([getCompaniesReview(), getAdminOverview()]);
      setCompaniesQueue(compRes.data || { pending: [], approved: [], rejected: [] });
      setOverview(ovRes.data);
      showToast("تم تحديث حالة الشركة بنجاح", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تحديث حالة الشركة"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleToggleSuspension = async (usr) => {
    const nextSuspended = !usr.suspended;
    const reason = nextSuspended ? "مخالفة شروط الاستخدام (قرار إداري)" : null;
    setBusyKey(`user-${usr.id}`);
    try {
      await updateAdminUserSuspension(usr.id, { suspended: nextSuspended, reason });
      await Promise.all([refreshUsers(), getAdminOverview().then((r) => setOverview(r.data))]);
      showToast(
        nextSuspended ? "تم تعليق الحساب وإبطال جلساته النشطة" : "تم إعادة تفعيل الحساب بنجاح",
        "success"
      );
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تحديث حالة الحساب"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleRevokeGrant = async (grantId) => {
    setBusyKey(`grant-${grantId}`);
    try {
      await revokeAdminSupportGrant(grantId);
      const grantsRes = await getAdminSupportGrants({ limit: 50 });
      setGrantsData(grantsRes.data || { total: 0, grants: [] });
      showToast("تم إلغاء تصريح الدعم الفني بنجاح", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر إلغاء تصريح الدعم"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleSavePrompt = async (key) => {
    const val = (promptDrafts[key] || "").trim();
    if (val.length < 10) {
      showToast("يجب ألا يقل نص التوجيه عن 10 أحرف", "error");
      return;
    }
    setBusyKey(`prompt-${key}`);
    try {
      const res = await updateAdminPrompt(key, val);
      const updated = res.data?.prompt;
      if (updated) {
        setPrompts((prev) => prev.map((p) => (p.key === key ? updated : p)));
      }
      showToast("تم حفظ وتطبيق قالب الأوامر فوراً", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تحديث قالب الأوامر"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleResetPrompt = async (key) => {
    setBusyKey(`prompt-reset-${key}`);
    try {
      const res = await resetAdminPrompt(key);
      const resetItem = res.data?.prompt;
      if (resetItem) {
        setPrompts((prev) => prev.map((p) => (p.key === key ? resetItem : p)));
        setPromptDrafts((prev) => ({ ...prev, [key]: resetItem.system_prompt }));
      }
      showToast("تمت استعادة النص الافتراضي للقالب", "info");
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر استعادة القالب الافتراضي"), "error");
    } finally {
      setBusyKey("");
    }
  };

  if (loading) {
    return (
      <div className="card py-12 text-center space-y-2">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-r-transparent" />
        <p className="text-sm font-bold text-slate-600">جاري تحميل لوحة إدارة المنصة...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="card max-w-xl mx-auto text-center space-y-3 py-10" dir="rtl">
        <ShieldCheck className="w-10 h-10 text-red-500 mx-auto" />
        <h1 className="text-xl font-black text-slate-900">صلاحية مدير النظام مطلوبة</h1>
        <p className="text-sm text-slate-600">
          هذه البوابة محصورة بمالك المنصة المعتمد فقط ولا يمكن الوصول إليها من حسابات المستخدمين أو الشركات العادية.
        </p>
      </div>
    );
  }

  const telemetry = overview?.ai_telemetry || {};
  const ollama = overview?.ollama || {};

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>System Administrator Portal</span>
          </span>
          <h1 className="text-2xl font-black text-slate-900">بوابة مدير النظام والحوكمة</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            إدارة المستخدمين والشركات، مراقبة زمن استجابة نماذج الذكاء الاصطناعي، وضبط قوالب التوجيه (Prompts).
          </p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="btn-outline !py-2 !px-4 !text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث المؤشرات</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const TabIcon = tab.Icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold border transition ${
                active
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500">إجمالي المستخدمين</span>
              <p className="text-2xl font-black text-slate-900">{overview?.users?.total ?? 0}</p>
              <p className="text-[11px] text-slate-500">
                {overview?.users?.candidates ?? 0} باحث عن عمل • {overview?.users?.suspended ?? 0} معلّق
              </p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500">حالة الشركات</span>
              <p className="text-2xl font-black text-slate-900">{overview?.companies?.approved ?? 0}</p>
              <p className="text-[11px] text-slate-500">
                قيد المراجعة: <strong className="text-amber-700">{overview?.companies?.pending ?? 0}</strong> • مرفوضة:{" "}
                {overview?.companies?.rejected ?? 0}
              </p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500">تحليلات السير والشواغر</span>
              <p className="text-2xl font-black text-slate-900">{overview?.content?.analyses ?? 0}</p>
              <p className="text-[11px] text-slate-500">
                شواغر نشطة: {overview?.content?.recruiter_jobs_active ?? 0} • تصاريح دعم:{" "}
                {overview?.content?.active_support_grants ?? 0}
              </p>
            </div>

            <div className="card p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500">نموذج الذكاء الاصطناعي المحلي</span>
              <p className="text-base font-black text-primary-700 truncate">
                {ollama.configured_model || "career-model"}
              </p>
              <p className="text-[11px] text-slate-500">
                الحالة:{" "}
                <strong
                  className={
                    ollama.status === "healthy" || ollama.status === "mocked_testing"
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                >
                  {ollama.status || "unknown"}
                </strong>{" "}
                • متوسط الاستجابة: {telemetry.avg_latency_ms ?? 0} ms
              </p>
            </div>
          </div>

          {telemetry.by_task && Object.keys(telemetry.by_task).length > 0 && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-black text-slate-900">توزيع استدعاءات الذكاء الاصطناعي حسب المهمة</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 font-bold">المهمة (Task)</th>
                      <th className="py-2 font-bold">الإجمالي</th>
                      <th className="py-2 font-bold">ناجح</th>
                      <th className="py-2 font-bold">أخطاء / بديل</th>
                      <th className="py-2 font-bold">متوسط الزمن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(telemetry.by_task).map(([taskName, stats]) => (
                      <tr key={taskName}>
                        <td className="py-2 font-bold text-slate-800">{taskName}</td>
                        <td className="py-2">{stats.calls}</td>
                        <td className="py-2 text-emerald-700 font-bold">{stats.ok}</td>
                        <td className="py-2 text-amber-700">{stats.errors}</td>
                        <td className="py-2">{stats.avg_latency_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GOVERNANCE (COMPANIES, USERS, SUPPORT GRANTS) */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          {/* Pending Companies Review */}
          <div className="card p-5 space-y-3">
            <h2 className="text-base font-black text-slate-900">طلبات اعتماد الشركات</h2>
            {companiesQueue.pending?.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد طلبات شركات قيد المراجعة حالياً.</p>
            ) : (
              <div className="space-y-2.5">
                {companiesQueue.pending?.map((comp) => (
                  <div
                    key={comp.company_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{comp.name}</p>
                      <p className="text-[11px] text-slate-500">
                        معرّف المالك: {comp.owner_id} • تاريخ التقديم: {String(comp.created_at || "").slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyKey === `company-${comp.company_id}`}
                        onClick={() => handleCompanyDecision(comp.company_id, "approved")}
                        className="btn-primary !py-1.5 !px-3 !text-xs inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اعتماد</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `company-${comp.company_id}`}
                        onClick={() => handleCompanyDecision(comp.company_id, "rejected")}
                        className="btn-outline !py-1.5 !px-3 !text-xs text-red-700 border-red-200 hover:bg-red-50 inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <span>إدارة الحسابات ({usersData.total})</span>
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  refreshUsers(userSearch);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو البريد..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="input-field !py-1.5 !pr-8 !pl-3 text-xs w-56"
                  />
                </div>
                <button type="submit" className="btn-secondary !py-1.5 !px-3 !text-xs">
                  بحث
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-bold">المستخدم</th>
                    <th className="py-2 font-bold">الدور</th>
                    <th className="py-2 font-bold">التحليلات</th>
                    <th className="py-2 font-bold">الحالة</th>
                    <th className="py-2 font-bold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersData.users?.map((usr) => (
                    <tr key={usr.id}>
                      <td className="py-2.5">
                        <p className="font-bold text-slate-900">
                          {usr.full_name}{" "}
                          {usr.is_platform_owner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
                              Owner
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">{usr.email}</p>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-600">{usr.role}</td>
                      <td className="py-2.5">{usr.analyses_count}</td>
                      <td className="py-2.5">
                        {usr.suspended ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">
                            معلّق
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            نشط
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {!usr.is_platform_owner && (
                          <button
                            type="button"
                            disabled={busyKey === `user-${usr.id}`}
                            onClick={() => handleToggleSuspension(usr)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                              usr.suspended
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            }`}
                          >
                            {usr.suspended ? <Check className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                            <span>{usr.suspended ? "إعادة تفعيل" : "تعليق الحساب"}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Support Grants */}
          <div className="card p-5 space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary-600" />
              <span>تصاريح الوصول للدعم الفني ({grantsData.total})</span>
            </h2>
            {grantsData.grants?.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد تصاريح دعم مسجلة.</p>
            ) : (
              <div className="space-y-2">
                {grantsData.grants?.slice(0, 15).map((g) => (
                  <div
                    key={g.grant_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {g.user_name || `User #${g.user_id}`} ({g.user_email || g.user_id})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        الحالة: {g.status} • ينتهي: {String(g.expires_at || "").slice(0, 16)}
                      </p>
                    </div>
                    {g.status === "active" && (
                      <button
                        type="button"
                        disabled={busyKey === `grant-${g.grant_id}`}
                        onClick={() => handleRevokeGrant(g.grant_id)}
                        className="btn-outline !py-1 !px-3 !text-[11px] text-red-700 border-red-200 hover:bg-red-50"
                      >
                        إلغاء التصريح
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI LOGS */}
      {activeTab === "ai-logs" && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">سجل استدعاءات نماذج الذكاء الاصطناعي</h2>
              <p className="text-xs text-slate-500">
                P95 Latency: <strong>{aiLogsData.summary?.p95_latency_ms ?? 0} ms</strong> • إجمالي السجلات:{" "}
                {aiLogsData.total}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={logTaskFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setLogTaskFilter(val);
                  refreshAiLogs(val);
                }}
                className="input-field !py-1.5 !px-3 text-xs"
              >
                <option value="">كل المهام</option>
                <option value="cv_extraction">cv_extraction</option>
                <option value="ats_evaluation">ats_evaluation</option>
                <option value="cover_letter">cover_letter</option>
                <option value="roadmap_generation">roadmap_generation</option>
                <option value="interview_reply">interview_reply</option>
                <option value="interview_evaluation">interview_evaluation</option>
                <option value="recruiter_fit_evaluation">recruiter_fit_evaluation</option>
              </select>
            </div>
          </div>

          {aiLogsData.logs?.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">لم تُسجّل استدعاءات AI ضمن هذا الفلتر بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-bold">الوقت</th>
                    <th className="py-2 font-bold">المهمة</th>
                    <th className="py-2 font-bold">المزود / النموذج</th>
                    <th className="py-2 font-bold">الحالة</th>
                    <th className="py-2 font-bold">الزمن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aiLogsData.logs?.map((entry, idx) => (
                    <tr key={`${entry.timestamp}-${idx}`}>
                      <td className="py-2 text-slate-500">{String(entry.timestamp || "").slice(0, 19).replace("T", " ")}</td>
                      <td className="py-2 font-bold text-slate-800">{entry.task}</td>
                      <td className="py-2 text-slate-600">
                        {entry.provider} • {entry.model}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${
                            entry.status === "ok"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {entry.status}
                          {entry.error_type ? ` (${entry.error_type})` : ""}
                        </span>
                      </td>
                      <td className="py-2 font-mono">{entry.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROMPTS TUNING */}
      {activeTab === "prompts" && (
        <div className="space-y-4">
          {prompts.map((item) => (
            <div key={item.key} className="card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{item.label}</h3>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                {item.is_customized && (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-[11px] font-bold">
                    مخصّص حالياً
                  </span>
                )}
              </div>

              <textarea
                rows={3}
                value={promptDrafts[item.key] ?? item.system_prompt}
                onChange={(e) =>
                  setPromptDrafts((prev) => ({ ...prev, [item.key]: e.target.value }))
                }
                className="input-field w-full text-xs font-mono"
              />

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busyKey === `prompt-reset-${item.key}` || !item.is_customized}
                  onClick={() => handleResetPrompt(item.key)}
                  className="btn-outline !py-1.5 !px-3 !text-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الافتراضي</span>
                </button>
                <button
                  type="button"
                  disabled={busyKey === `prompt-${item.key}`}
                  onClick={() => handleSavePrompt(item.key)}
                  className="btn-primary !py-1.5 !px-4 !text-xs inline-flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ القالب</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
