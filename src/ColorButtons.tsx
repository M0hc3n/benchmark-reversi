import { BLACK, WHITE } from './consts'
import React from 'react'

import { ColorButton } from './ColorButton'

interface Props {
  onClick: (x: string) => void
}

export function ColorButtons({ onClick }: Props) {
  return (
    <>
      <ColorButton color="white" background="black" x={160} y={300} value={WHITE} onClick={onClick}>
        Black
      </ColorButton>
      <ColorButton color="black" background="white" x={480} y={300} value={BLACK} onClick={onClick}>
        White
      </ColorButton>
    </>
  )
}
