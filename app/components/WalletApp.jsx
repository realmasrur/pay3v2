"use client";

import { useState } from "react";
import { History, Home, Link2, Search, ShieldAlert } from "lucide-react";
import { AppProvider, useApp } from "./AppProvider";
import { Toast, Spinner } from "./ui";
import { WelcomeScreen, UnlockScreen, CreateWalletFlow, ImportWalletFlow, AddWalletScreen } from "./screens/Auth";
import HomeScreen from "./screens/Home";
import AssetsScreen from "./screens/Assets";
import ActivityScreen from "./screens/Activity";
import SendScreen from "./screens/Send";
import ReceiveScreen from "./screens/Receive";
import { SettingsScreen, DisplayScreen } from "./screens/Settings";
import WalletManageScreen from "./screens/WalletManage";
import { NftsScreen, AppsScreen } from "./screens/NftsApps";
import { WalletSwitcherSheet, AddWalletSheet, SwitchingOverlay } from "./sheets/WalletSheets";
import { NetworkSheet, AssetSheet, AddCoinSheet } from "./sheets/CoinSheets";
import { ConnectSheet, SessionProposalModal, SessionRequestModal } from "./sheets/ConnectSheets";

const TABS = [
  { name: "home", icon: Home, label: "Home" },
  { name: "apps", icon: Link2, label: "Apps" },
  { name: "assets", icon: Search, label: "Search" },
  { name: "activity", icon: History, label: "Activity" },
];

function BottomNav() {
  const { route, goTab } = useApp();
  return (
    <nav className="p3-bottomnav" aria-label="Main">
      {TABS.map(({ name, icon: Icon, label }) => (
        <button key={name} className={`p3-navbtn ${route.name === name ? "active" : ""}`} onClick={() => goTab(name)} aria-label={label} aria-current={route.name === name ? "page" : undefined}>
          <Icon size={24} strokeWidth={route.name === name ? 2.4 : 2} />
        </button>
      ))}
    </nav>
  );
}

function Screens() {
  const { route } = useApp();
  const p = route.params || {};
  switch (route.name) {
    case "home": return <HomeScreen />;
    case "assets": return <AssetsScreen />;
    case "activity": return <ActivityScreen />;
    case "apps": return <AppsScreen />;
    case "send": return <SendScreen params={p} />;
    case "receive": return <ReceiveScreen params={p} />;
    case "settings": return <SettingsScreen />;
    case "display": return <DisplayScreen />;
    case "wallet": return <WalletManageScreen params={p} />;
    case "nfts": return <NftsScreen />;
    case "addWallet": return <AddWalletScreen params={p} />;
    default: return <HomeScreen />;
  }
}

function Sheets() {
  const { sheet, pendingProposal, pendingRequest, switching } = useApp();
  return (
    <>
      {sheet?.type === "wallets" && <WalletSwitcherSheet />}
      {sheet?.type === "addWallet" && <AddWalletSheet />}
      {sheet?.type === "network" && <NetworkSheet />}
      {sheet?.type === "asset" && <AssetSheet params={sheet.params} />}
      {sheet?.type === "addCoin" && <AddCoinSheet params={sheet.params} />}
      {sheet?.type === "connect" && <ConnectSheet />}
      {pendingProposal && <SessionProposalModal />}
      {pendingRequest && <SessionRequestModal />}
      {switching && <SwitchingOverlay />}
    </>
  );
}

const TAB_NAMES = TABS.map((t) => t.name);

function Shell() {
  const { stage, route, toast, hasAlchemyKey } = useApp();
  const [authView, setAuthView] = useState("welcome");

  return (
    <div className="p3-root">
      <div className="p3-shell">
        {!hasAlchemyKey && stage !== "loading" && (
          <div className="p3-configwarn">
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              No Alchemy API key found. Set <code>NEXT_PUBLIC_ALCHEMY_API_KEY</code> in your environment, then restart the app.
            </span>
          </div>
        )}

        {stage === "loading" && (
          <div className="p3-center-loader">
            <Spinner size={28} />
            <span>Loading Pay3…</span>
          </div>
        )}

        {stage === "welcome" && (
          <div className="p3-scroll">
            {authView === "welcome" && <WelcomeScreen onCreate={() => setAuthView("create")} onImport={() => setAuthView("import")} />}
            {authView === "create" && <CreateWalletFlow firstRun onBack={() => setAuthView("welcome")} />}
            {authView === "import" && <ImportWalletFlow firstRun onBack={() => setAuthView("welcome")} />}
          </div>
        )}

        {stage === "unlock" && (
          <div className="p3-scroll">
            <UnlockScreen />
          </div>
        )}

        {stage === "app" && (
          <>
            <div className={`p3-scroll ${TAB_NAMES.includes(route.name) ? "withnav" : ""}`}>
              <Screens />
            </div>
            {TAB_NAMES.includes(route.name) && <BottomNav />}
            <Sheets />
          </>
        )}

        <Toast toast={toast} />
      </div>
    </div>
  );
}

export default function WalletApp() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
