import {create} from "zustand";

type State = {
  loading: boolean
  label: string
}

type OpenConfig = {
  label: string
  duration?: number
}

type Actions = {
  open: (config: OpenConfig) => void,
  close: () => void,
}

export const useAppGlobalLoader = create<State & Actions>((setState, getState) => ({
  loading: false,
  label: '',
  open: (config: OpenConfig) => {
    const {label, duration = 1000} = config
    setState({loading: true, label})
    setTimeout(() => setState({loading: false, label: ''}), duration)
  },
  close: () => setState({loading: false, label: ''}),
}))
