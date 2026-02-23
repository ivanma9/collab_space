import { useEffect, useRef, useState } from "react"
import type { OnlineUser } from "../../hooks/usePresence"
import { getUserColor } from "../../lib/userColors"

interface BoardTopBarProps {
	boardName?: string
	displayName: string
	inviteCode: string | null
	onlineUsers: OnlineUser[]
	currentUserId: string
	onNavigateBack: () => void
	onSignOut: () => Promise<void>
}

function ShareIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="18" cy="5" r="3" />
			<circle cx="6" cy="12" r="3" />
			<circle cx="18" cy="19" r="3" />
			<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
			<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
		</svg>
	)
}

function ArrowLeftIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="19" y1="12" x2="5" y2="12" />
			<polyline points="12 19 5 12 12 5" />
		</svg>
	)
}

export function BoardTopBar({
	displayName,
	inviteCode,
	onlineUsers,
	currentUserId,
	onNavigateBack,
	onSignOut,
}: BoardTopBarProps) {
	const [showShare, setShowShare] = useState(false)
	const [showUserMenu, setShowUserMenu] = useState(false)
	const userMenuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!showUserMenu) return
		function handleClickOutside(e: MouseEvent) {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
				setShowUserMenu(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [showUserMenu])

	return (
		<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between h-12 px-4 bg-white/90 backdrop-blur-sm border-b border-gray-200">
			{/* Left: navigation */}
			<div className="flex items-center gap-3">
				<button
					onClick={onNavigateBack}
					className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
				>
					<ArrowLeftIcon />
					<span className="font-medium">My Boards</span>
				</button>
			</div>

			{/* Right: share, presence, user menu */}
			<div className="flex items-center gap-3">
				{/* Share */}
				<div className="relative">
					<button
						onClick={() => setShowShare((v) => !v)}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
							showShare
								? "bg-blue-100 text-blue-700"
								: "text-gray-600 hover:bg-gray-100"
						}`}
					>
						<ShareIcon />
						<span>Share</span>
					</button>

					{/* Share dropdown */}
					{showShare && inviteCode && (
						<div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 space-y-3">
							<div>
								<p className="text-xs text-gray-500 font-medium mb-1">
									Invite code
								</p>
								<p className="font-mono text-lg font-bold text-gray-800 tracking-widest">
									{inviteCode}
								</p>
							</div>
							<div>
								<p className="text-xs text-gray-500 font-medium mb-1">
									Invite link
								</p>
								<button
									onClick={() => {
										navigator.clipboard.writeText(
											`${window.location.origin}/join/${inviteCode}`,
										)
									}}
									className="w-full text-left bg-gray-50 border rounded-lg px-3 py-2 font-mono text-xs text-gray-600 hover:bg-gray-100 truncate transition"
									title="Click to copy"
								>
									{window.location.origin}/join/{inviteCode}
								</button>
								<p className="text-[10px] text-gray-400 mt-1">
									Click to copy
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-gray-200" />

				{/* Presence avatars */}
				<div className="flex items-center gap-2" data-testid="presence-bar">
					<span className="text-xs text-gray-400 font-medium">
						{onlineUsers.length}
					</span>
					<div className="flex -space-x-2">
						{onlineUsers.map((u) => (
							<div
								key={u.userId}
								title={u.userName}
								className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${
									u.userId === currentUserId
										? "ring-2 ring-blue-500"
										: ""
								}`}
								style={{
									backgroundColor: getUserColor(u.userId),
								}}
								data-testid={`presence-user-${u.userId}`}
							>
								{u.avatarUrl ? (
									<img
										src={u.avatarUrl}
										alt={u.userName}
										className="w-full h-full rounded-full object-cover"
									/>
								) : (
									u.userName.charAt(0).toUpperCase()
								)}
							</div>
						))}
					</div>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-gray-200" />

				{/* User menu */}
				<div className="relative" ref={userMenuRef}>
					<button
						onClick={() => setShowUserMenu((v) => !v)}
						className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
						data-testid="user-menu-button"
					>
						{displayName}
					</button>

					{showUserMenu && (
						<div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1">
							<button
								onClick={() => {
									setShowUserMenu(false)
									onSignOut()
								}}
								className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
								data-testid="sign-out-button"
							>
								Sign out
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
