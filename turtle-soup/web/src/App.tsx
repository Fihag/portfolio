import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import SoupAdmin from "./pages/SoupAdmin";
import { socket, getToken } from "./socket";
import ConfirmDialog from "./components/ConfirmDialog";
import FeedbackDialog from "./components/FeedbackDialog";

// 与 Game.tsx 保持一致:标记当前用户是否为房主
const HOST_KEY = "turtle-soup-in-room-host";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const inGame = location.pathname.startsWith("/game/");
  // 手绘风退出确认框:记录待跳转目标
  const [navTarget, setNavTarget] = useState<string | null>(null);
  // 反馈对话框
  const [fbOpen, setFbOpen] = useState(false);
  // 是否已登录(决定反馈按钮是否可用;登录/登出通过自定义事件同步)
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  useEffect(() => {
    const sync = () => setLoggedIn(!!getToken());
    window.addEventListener("turtle-soup-auth", sync);
    return () => window.removeEventListener("turtle-soup-auth", sync);
  }, []);

  // 在游戏页内点底部导航:房主弹"退出并解散"确认,玩家弹"退出房间"确认
  function handleNav(e: React.MouseEvent, to: string) {
    if (!inGame) {
      navigate(to);
      return;
    }
    e.preventDefault();
    setNavTarget(to);
  }

  function confirmNav() {
    const to = navTarget;
    setNavTarget(null);
    socket.emit("leave_room");
    sessionStorage.removeItem(HOST_KEY);
    navigate(to || "/");
  }

  // 反馈按钮:未登录不可用;游戏中需先退出房间再打开
  function openFeedback(e: React.MouseEvent) {
    if (!loggedIn) {
      e.preventDefault();
      return; // 未登录:置灰禁用,不响应
    }
    if (!inGame) {
      setFbOpen(true);
      return;
    }
    e.preventDefault();
    setNavTarget("__feedback__");
  }

  function confirmNavOrFeedback() {
    if (navTarget === "__feedback__") {
      setNavTarget(null);
      socket.emit("leave_room");
      sessionStorage.removeItem(HOST_KEY);
      navigate("/");
      setFbOpen(true);
      return;
    }
    confirmNav();
  }

  const isHost = sessionStorage.getItem(HOST_KEY) === "1";

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<Game />} />
        <Route path="/soups" element={<SoupAdmin />} />
      </Routes>
      <footer className="app-footer">
        <Link to="/" onClick={(e) => handleNav(e, "/")}>
          大厅
        </Link>
        <span>·</span>
        <a
          href="#feedback"
          onClick={(e) => openFeedback(e)}
          title={loggedIn ? "提交建议或反馈" : "请先登录后再提交反馈"}
          style={{
            cursor: loggedIn ? "pointer" : "not-allowed",
            color: "inherit",
            textDecoration: "none",
            opacity: loggedIn ? 1 : 0.4,
            pointerEvents: loggedIn ? "auto" : "none",
          }}
        >
          反馈
        </a>
        <span>·</span>
        <Link to="/soups" onClick={(e) => handleNav(e, "/soups")}>
          题库管理
        </Link>
      </footer>
      {/* 游戏页内点导航的退出确认(含反馈入口) */}
      <ConfirmDialog
        open={!!navTarget}
        title={isHost ? "退出并解散房间" : "退出房间"}
        message={
          navTarget === "__feedback__"
            ? "需要先退出房间才能提交反馈。确认退出吗?"
            : isHost
              ? "退出房间将解散整个房间,所有成员都会被移出。确认退出并解散吗?"
              : "确认退出这个房间吗?"
        }
        confirmText="确认退出"
        danger={isHost && navTarget !== "__feedback__"}
        onConfirm={confirmNavOrFeedback}
        onCancel={() => setNavTarget(null)}
      />
      {/* 反馈对话框 */}
      <FeedbackDialog open={fbOpen} onClose={() => setFbOpen(false)} />
    </div>
  );
}
