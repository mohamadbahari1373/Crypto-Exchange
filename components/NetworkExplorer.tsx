'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Network,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { Language, Theme, NetworksApiResponse, CoinNetworkData, ExchangeCoinNetworkGroup, ExchangeNetworkDetail } from '@/lib/types';
import { translations } from '@/lib/translations';
import { toPersianDigits } from '@/lib/formatters';

interface NetworkExplorerProps {
  lang: Language;
  theme: Theme;
}

export default function NetworkExplorer({ lang, theme }: NetworkExplorerProps) {
  const [data, setData] = useState<NetworksApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState<string>('USDT');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');

  const t = translations[lang];
  const isDark = theme === 'dark';

  const fetchNetworks = async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/networks', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: NetworksApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching networks data:', err);
      setError(err.message || 'خطا در بارگذاری شبکه‌ها');
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
      try {
        const res = await fetch('/api/networks', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: NetworksApiResponse = await res.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'خطا در بارگذاری شبکه‌ها');
          setLoading(false);
        }
      }
    };

    initialLoad();

    const interval = setInterval(() => {
      initialLoad();
    }, 120000); // 2 minutes auto-refresh

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const coins = data?.coins;

  // Filter coins list based on search query
  const filteredCoins = useMemo(() => {
    if (!coins || coins.length === 0) return [];
    if (!searchQuery.trim()) return coins;
    const q = searchQuery.toLowerCase().trim();
    return coins.filter((coin) => {
      const matchSymbol = coin.symbol.toLowerCase().includes(q);
      const matchNameFa = coin.nameFa.toLowerCase().includes(q);
      const matchNameEn = coin.nameEn.toLowerCase().includes(q);
      const matchNetwork = coin.allAvailableNetworks.some((n) => n.toLowerCase().includes(q));
      return matchSymbol || matchNameFa || matchNameEn || matchNetwork;
    });
  }, [coins, searchQuery]);

  // Active selected coin data
  const currentCoin: CoinNetworkData | undefined = useMemo(() => {
    if (!coins || coins.length === 0) return undefined;
    return (
      coins.find((c) => c.symbol === selectedCoinSymbol) ||
      filteredCoins[0] ||
      coins[0]
    );
  }, [coins, selectedCoinSymbol, filteredCoins]);

  // Summary counts of disabled networks across exchanges for the current coin
  const networkStats = useMemo(() => {
    if (!currentCoin) return { total: 0, active: 0, disabled: 0 };
    let total = 0;
    let active = 0;
    let disabled = 0;

    Object.values(currentCoin.exchanges).forEach((ex) => {
      total += ex.totalSupported;
      active += ex.activeCount;
      disabled += ex.disabledCount;
    });

    return { total, active, disabled };
  }, [currentCoin]);

  // Render Status Badge
  const renderStatusBadge = (detail: ExchangeNetworkDetail) => {
    const isOverallActive = detail.overallStatus === 'active';
    const isDepositDisabled = detail.depositStatus === 'disabled';
    const isWithdrawDisabled = detail.withdrawStatus === 'disabled';

    if (isOverallActive) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
            isDark
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t.networkStatusActive}</span>
        </span>
      );
    }

    if (isDepositDisabled && isWithdrawDisabled) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
            isDark
              ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>{t.networkDepositAndWithdrawDisabled}</span>
        </span>
      );
    }

    if (isDepositDisabled) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
            isDark
              ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{t.networkDepositDisabled}</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
          isDark
            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{t.networkWithdrawDisabled}</span>
      </span>
    );
  };

  return (
    <div className="space-y-5" id="network-explorer-container">
      {/* Top Banner & Refresh */}
      <div
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border ${
          isDark
            ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner ${
              isDark
                ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-900/60'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}
          >
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>{t.navNetworks}</span>
              {networkStats.disabled > 0 && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    isDark
                      ? 'bg-rose-950/90 text-rose-300 border border-rose-800/80'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {lang === 'fa' ? toPersianDigits(networkStats.disabled) : networkStats.disabled}{' '}
                  {t.networkAlertCount}
                </span>
              )}
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.navNetworksDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
          <button
            id="btn-refresh-networks"
            onClick={() => fetchNetworks(true)}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? t.refreshing : t.refresh}</span>
          </button>
        </div>
      </div>

      {/* Coin Selector Bar & Search */}
      <div
        className={`p-4 rounded-xl border space-y-3 ${
          isDark
            ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 ${
                lang === 'fa' ? 'right-3' : 'left-3'
              } ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <input
              type="text"
              id="input-network-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.networkSearchPlaceholder}
              className={`w-full text-xs rounded-lg py-2 transition-all outline-hidden border ${
                lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'
              } ${
                isDark
                  ? 'bg-slate-900/80 border-slate-700/80 text-slate-100 placeholder-slate-500 focus:border-blue-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Filters: Status & Exchange */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`flex items-center p-1 rounded-lg border text-xs ${
                isDark ? 'bg-slate-900/80 border-slate-700/80' : 'bg-slate-100 border-slate-300'
              }`}
            >
              <button
                id="btn-filter-status-all"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded transition-all font-medium ${
                  statusFilter === 'all'
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-700 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.networkStatusAll}
              </button>
              <button
                id="btn-filter-status-active"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded transition-all font-medium ${
                  statusFilter === 'active'
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-700 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.networkStatusActive}
              </button>
              <button
                id="btn-filter-status-disabled"
                onClick={() => setStatusFilter('disabled')}
                className={`px-2.5 py-1 rounded transition-all font-medium ${
                  statusFilter === 'disabled'
                    ? isDark
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-600 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.networkStatusDisabled}
              </button>
            </div>

            <select
              id="select-filter-exchange"
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border outline-hidden transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            >
              <option value="all">{lang === 'fa' ? 'همه صرافی‌ها' : 'All Exchanges'}</option>
              <option value="wallex">{lang === 'fa' ? 'والکس (صرافی پیش‌فرض)' : 'Wallex'}</option>
              <option value="nobitex">{lang === 'fa' ? 'نوبیتکس' : 'Nobitex'}</option>
              <option value="bitpin">{lang === 'fa' ? 'بیت‌پین' : 'Bitpin'}</option>
              <option value="ramzinex">{lang === 'fa' ? 'رمزینکس' : 'Ramzinex'}</option>
            </select>
          </div>
        </div>

        {/* Quick Horizontal Coin Pills */}
        <div>
          <span className={`text-[11px] font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.networkSelectCoin}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {filteredCoins.slice(0, 16).map((coin) => {
              const isSelected = currentCoin?.symbol === coin.symbol;
              const hasAlerts = coin.disabledAlertsCount > 0;
              return (
                <button
                  key={coin.symbol}
                  id={`btn-coin-${coin.symbol.toLowerCase()}`}
                  onClick={() => setSelectedCoinSymbol(coin.symbol)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : isDark
                      ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100/80 border-slate-200 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {coin.icon && (
                    <Image
                      src={coin.icon}
                      alt={coin.symbol}
                      width={16}
                      height={16}
                      className="rounded-full shrink-0"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  )}
                  <span>{coin.symbol}</span>
                  {hasAlerts && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-amber-300' : 'bg-rose-500'
                      } animate-pulse`}
                      title={`${coin.disabledAlertsCount} هشدار قطعی شبکه`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div
          className={`p-12 text-center rounded-xl border ${
            isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-xs text-slate-400">{t.refreshing}</p>
        </div>
      )}

      {error && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            isDark
              ? 'bg-rose-950/50 border-rose-800 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Coin Networks Detail View */}
      {currentCoin && (
        <div className="space-y-4">
          {/* Active Coin Headline */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {currentCoin.icon && (
                <div className="w-12 h-12 rounded-xl bg-slate-800/40 p-1 flex items-center justify-center border border-slate-700/50">
                  <Image
                    src={currentCoin.icon}
                    alt={currentCoin.symbol}
                    width={36}
                    height={36}
                    className="rounded-full"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">
                    {lang === 'fa' ? currentCoin.nameFa : currentCoin.nameEn}
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {currentCoin.symbol}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lang === 'fa'
                    ? `شبکه‌های انتقال شناخته‌شده در بازار: ${currentCoin.allAvailableNetworks.join(
                        ' • '
                      )}`
                    : `Known Transfer Networks: ${currentCoin.allAvailableNetworks.join(' • ')}`}
                </p>
              </div>
            </div>

            {/* Overall Status Pill for this Coin */}
            <div className="flex items-center gap-2">
              {networkStats.disabled > 0 ? (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    isDark
                      ? 'bg-rose-950/70 border border-rose-800 text-rose-300'
                      : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>
                    {lang === 'fa'
                      ? `${toPersianDigits(networkStats.disabled)} مورد غیرفعال / مسدود`
                      : `${networkStats.disabled} Suspended Network(s)`}
                  </span>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    isDark
                      ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t.networkNoDisabledAlerts}</span>
                </div>
              )}
            </div>
          </div>

          {/* Exchanges Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(currentCoin.exchanges)
              .filter(([exId]) => exchangeFilter === 'all' || exchangeFilter === exId)
              .map(([exchangeId, exGroup]: [string, ExchangeCoinNetworkGroup]) => {
                const isWallex = exchangeId === 'wallex';

                // Filter networks by status filter if chosen
                const visibleNetworks = exGroup.supportedNetworks.filter((net) => {
                  if (statusFilter === 'active') return net.overallStatus === 'active';
                  if (statusFilter === 'disabled') return net.overallStatus !== 'active';
                  return true;
                });

                return (
                  <div
                    key={exchangeId}
                    id={`exchange-network-card-${exchangeId}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isWallex
                        ? isDark
                          ? 'bg-slate-900/90 border-blue-900/80 shadow-md ring-1 ring-blue-500/20'
                          : 'bg-blue-50/40 border-blue-200 shadow-xs ring-1 ring-blue-500/10'
                        : isDark
                        ? 'bg-[#0F172A] border-slate-800/80 shadow-sm'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Exchange Header */}
                    <div className="flex items-center justify-between border-b pb-3 mb-3 border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <Building2
                          className={`w-4 h-4 ${
                            isWallex ? 'text-blue-500' : isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        />
                        <h4 className="font-bold text-sm flex items-center gap-1.5">
                          <span>
                            {lang === 'fa' ? exGroup.exchangeNameFa : exGroup.exchangeNameEn}
                          </span>
                          {isWallex && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold">
                              {lang === 'fa' ? 'صرافی شما' : 'Your Exchange'}
                            </span>
                          )}
                        </h4>
                      </div>

                      {/* Stat counter */}
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {lang === 'fa'
                            ? `${toPersianDigits(exGroup.activeCount)} فعال از ${toPersianDigits(
                                exGroup.totalSupported
                              )}`
                            : `${exGroup.activeCount} active of ${exGroup.totalSupported}`}
                        </span>
                        {exGroup.disabledCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                            {lang === 'fa'
                              ? `${toPersianDigits(exGroup.disabledCount)} مسدود`
                              : `${exGroup.disabledCount} disabled`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Networks List in this Exchange */}
                    {visibleNetworks.length === 0 ? (
                      <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {statusFilter === 'disabled'
                          ? lang === 'fa'
                            ? 'هیچ شبکه غیرفعالی در این صرافی وجود ندارد.'
                            : 'No disabled networks in this exchange.'
                          : lang === 'fa'
                          ? 'شبکه‌ای با فیلتر انتخابی یافت نشد.'
                          : 'No networks match this filter.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {visibleNetworks.map((net) => {
                          const isOverallDisabled = net.overallStatus !== 'active';
                          return (
                            <div
                              key={net.networkCode}
                              className={`p-3 rounded-lg border transition-all ${
                                isOverallDisabled
                                  ? isDark
                                    ? 'bg-rose-950/20 border-rose-900/60'
                                    : 'bg-rose-50/60 border-rose-200'
                                  : isDark
                                  ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs">
                                    {net.networkCode}
                                  </span>
                                  <span
                                    className={`text-xs ${
                                      isDark ? 'text-slate-400' : 'text-slate-600'
                                    }`}
                                  >
                                    {net.networkName}
                                  </span>
                                  {net.suggested && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium">
                                      {t.networkSuggested}
                                    </span>
                                  )}
                                </div>
                                {renderStatusBadge(net)}
                              </div>

                              {/* Granular Deposit & Withdrawal Status */}
                              <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                  {/* Deposit Status */}
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      net.depositStatus === 'enabled'
                                        ? isDark
                                          ? 'text-emerald-400'
                                          : 'text-emerald-700'
                                        : isDark
                                        ? 'text-rose-400 font-semibold'
                                        : 'text-rose-700 font-semibold'
                                    }`}
                                  >
                                    <ArrowDownLeft className="w-3 h-3" />
                                    <span>
                                      {lang === 'fa' ? 'واریز:' : 'Deposit:'}{' '}
                                      {net.depositStatus === 'enabled'
                                        ? lang === 'fa'
                                          ? 'فعال'
                                          : 'Enabled'
                                        : lang === 'fa'
                                        ? 'غیرفعال'
                                        : 'Disabled'}
                                    </span>
                                  </span>

                                  {/* Withdraw Status */}
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      net.withdrawStatus === 'enabled'
                                        ? isDark
                                          ? 'text-emerald-400'
                                          : 'text-emerald-700'
                                        : isDark
                                        ? 'text-rose-400 font-semibold'
                                        : 'text-rose-700 font-semibold'
                                    }`}
                                  >
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span>
                                      {lang === 'fa' ? 'برداشت:' : 'Withdrawal:'}{' '}
                                      {net.withdrawStatus === 'enabled'
                                        ? lang === 'fa'
                                          ? 'فعال'
                                          : 'Enabled'
                                        : lang === 'fa'
                                        ? 'غیرفعال'
                                        : 'Disabled'}
                                    </span>
                                  </span>
                                </div>

                                {/* Fees & Minimums if present */}
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  {net.fee !== undefined && (
                                    <span>
                                      {t.networkFee}{' '}
                                      <strong className="text-slate-300 font-mono">
                                        {lang === 'fa' ? toPersianDigits(net.fee) : net.fee}{' '}
                                        {currentCoin.symbol}
                                      </strong>
                                    </span>
                                  )}
                                  {net.minWithdraw !== undefined && (
                                    <span>
                                      {t.networkMinWithdraw}{' '}
                                      <span className="text-slate-300 font-mono">
                                        {lang === 'fa'
                                          ? toPersianDigits(net.minWithdraw)
                                          : net.minWithdraw}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Alert Banner for Disabled Network */}
                              {isOverallDisabled && (
                                <div
                                  className={`mt-2 p-2 rounded text-[11px] flex items-center gap-1.5 ${
                                    isDark
                                      ? 'bg-rose-950/60 text-rose-300 border border-rose-900/50'
                                      : 'bg-rose-100/80 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                  <span>
                                    {net.message ||
                                      (net.depositStatus === 'disabled' &&
                                      net.withdrawStatus === 'disabled'
                                        ? lang === 'fa'
                                          ? 'انتقال روی این شبکه هم‌اکنون به دلیل ارتقای فنی یا اختلال نود موقتاً متوقف است.'
                                          : 'Transfers on this network are suspended due to node maintenance.'
                                        : net.depositStatus === 'disabled'
                                        ? lang === 'fa'
                                          ? 'تنها واریز روی این شبکه مسدود است، اما امکان برداشت وجود دارد.'
                                          : 'Deposit suspended, withdrawal remains operational.'
                                        : lang === 'fa'
                                        ? 'واریز فعال است ولی امکان ثبت درخواست برداشت وجود ندارد.'
                                        : 'Withdrawal suspended, deposit remains operational.')}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty Search Result */}
      {filteredCoins.length === 0 && !loading && (
        <div
          className={`p-12 text-center rounded-xl border ${
            isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <Network className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
          <h4 className="text-sm font-bold">{t.networkNoCoinsFound}</h4>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {lang === 'fa'
              ? 'هیچ رمزارزی با نماد یا شبکه جستجو شده مطابقت نداشت.'
              : 'No cryptocurrency matched the given symbol or network name.'}
          </p>
        </div>
      )}
    </div>
  );
}
