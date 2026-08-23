import { SVGProps } from "react"

const SVGAdd = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={37.374}
    height={33.701}
    viewBox="0 0 37.374 33.701"
    fill="var(--bg-secondary)"
    {...props}
  >
    <rect
      x={1}
      y={5}
      width={30}
      height={24}
      fill="var(--bg-secondary)"
      rx={0}
    />

    <path
      fill="var(--color-alt)"
      d="M4.9.483H0v33.7h14.75v-4.9H4.9V5.381h9.85V.483ZM27.954.483H17.828v4.9h10.126v23.903H17.828v4.9H32.85V.483Z"
    />
    <path
      fill="var(--color-alt)"
      d="M17.177 9.851h-1.5v6.25h-5.75v1.5h5.75v6.25h1.5v-6.25h5.75v-1.5h-5.75v-5.5Z"
    />
  </svg>
)

export default SVGAdd
