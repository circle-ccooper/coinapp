import type { Session } from '@supabase/supabase-js'
import React, { type PropsWithChildren, createContext, useState } from 'react'

interface Context {
  phone?: string
  firstName?: string
  lastName?: string
  username?: string
  session?: Session
  updateState: (newValues: Partial<Context>) => void
}

export const GlobalContext = createContext<Context>({
  updateState: () => {}
})

export function GlobalContextProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState({})

  const updateState = (newValues: Partial<Context>) => {
    setState(prevState => ({ ...prevState, ...newValues }))
  }

  return (
    <GlobalContext.Provider value={{ ...state, updateState }}>
      {children}
    </GlobalContext.Provider>
  )
}