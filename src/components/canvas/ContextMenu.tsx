import { memo, useEffect, useRef } from "react";

interface ContextMenuProps {
	x: number;
	y: number;
	onBringToFront: () => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onSendToBack: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onClose: () => void;
}

export const ContextMenu = memo(function ContextMenu({
	x,
	y,
	onBringToFront,
	onBringForward,
	onSendBackward,
	onSendToBack,
	onDuplicate,
	onDelete,
	onClose,
}: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [onClose]);

	const handleAction = (action: () => void) => {
		action();
		onClose();
	};

	return (
		<div
			ref={menuRef}
			className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[200px]"
			style={{ left: x, top: y }}
		>
			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onBringToFront)}
			>
				<span>Bring to Front</span>
				<span className="text-gray-400 text-xs ml-4">⌘]</span>
			</button>
			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onBringForward)}
			>
				<span>Bring Forward</span>
				<span className="text-gray-400 text-xs ml-4">]</span>
			</button>
			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onSendBackward)}
			>
				<span>Send Backward</span>
				<span className="text-gray-400 text-xs ml-4">[</span>
			</button>
			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onSendToBack)}
			>
				<span>Send to Back</span>
				<span className="text-gray-400 text-xs ml-4">⌘[</span>
			</button>

			<div className="my-1 border-t border-gray-200" />

			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onDuplicate)}
			>
				<span>Duplicate</span>
				<span className="text-gray-400 text-xs ml-4">⌘D</span>
			</button>
			<button
				className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-red-500 hover:bg-gray-100 text-left"
				onClick={() => handleAction(onDelete)}
			>
				<span>Delete</span>
				<span className="text-red-400 text-xs ml-4">⌫</span>
			</button>
		</div>
	);
})
