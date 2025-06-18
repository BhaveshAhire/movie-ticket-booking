import React from 'react'

const Title = ({text1,text2}) => {
  return (
   <h1 className='text-2xl font-medium'>{text1} <span className='underline text-primary'>{text2}</span></h1>
  )
}

export default Title
