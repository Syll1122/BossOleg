// Leaf Logo Component for W.A.T.C.H.
import './LeafLogo.css';

interface LeafLogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LeafLogo({ size = 'medium', className = '' }: LeafLogoProps) {
  const sizeClasses = {
    small: 'leaf-logo-small',
    medium: 'leaf-logo-medium',
    large: 'leaf-logo-large'
  };

  return (
    <div className={`leaf-logo ${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Leaf Shape */}
        <path
          d="M50 20 C30 20, 15 35, 15 50 C15 65, 25 75, 35 80 C40 85, 45 88, 50 90 C55 88, 60 85, 65 80 C75 75, 85 65, 85 50 C85 35, 70 20, 50 20 Z"
          fill="url(#leafGradient)"
          stroke="#15803d"
          strokeWidth="2"
        />
        {/* Leaf Veins */}
        <path
          d="M50 20 L50 90 M35 50 L50 20 L65 50 M25 60 L50 20 L75 60"
          stroke="#065f46"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        <defs>
          <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

