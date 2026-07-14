import styles from './Logo.module.css'

interface LogoProps {
  /** 图标像素尺寸 */
  size?: number
  /** "TASK" 文字字号 */
  textSize?: number
  className?: string
}

// 全站统一品牌 Logo：图形与 public/favicon.svg 保持一致（双对勾），颜色跟随主题主色
export default function Logo({ size = 22, textSize = 16, className }: LogoProps) {
  return (
    <span className={className ? `${styles.logo} ${className}` : styles.logo}>
      <svg
        className={styles.icon}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M2.10059 11.4141L7.05033 16.3638L7.40389 16.0103M16.2426 7.17139L12.3535 11.0605M21.8999 7.17139L12.7076 16.3638L7.75781 11.414"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
      <span className={styles.text} style={{ fontSize: textSize }}>
        TASK
      </span>
    </span>
  )
}
