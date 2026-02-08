import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../store';

interface ModalProps {
    id: string;
    title?: string;
    children: React.ReactNode;
    onClose?: () => void;
    showCloseButton?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
};

export const Modal = ({
    id,
    title,
    children,
    onClose,
    showCloseButton = true,
    size = 'md',
}: ModalProps) => {
    const { modalOpen, closeModal } = useUIStore();
    const overlayRef = useRef<HTMLDivElement>(null);

    const isOpen = modalOpen === id;

    const handleClose = useCallback(() => {
        onClose?.();
        closeModal();
    }, [onClose, closeModal]);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    // Close on overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
            <div
                className={`w-full ${sizes[size]} glass-card p-6 animate-slide-up`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between mb-4">
                        {title && (
                            <h2 id="modal-title" className="text-lg font-semibold text-dark-100">
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                {children}
            </div>
        </div>
    );
};

export default Modal;
