import { createStore, applyMiddleware, compose } from 'redux'
import createSagaMiddleware, { END } from 'redux-saga'
import reducer from './reducer'

const getDevtools = () => {
  if (__DEV__) {
    return window.devToolsExtension ? window.devToolsExtension() : (f) => f
  }
  return (f) => f
}

const configureStore = () => {
  const sagaMiddleware = createSagaMiddleware()
  const store = createStore(
    reducer,
    compose(
      applyMiddleware(sagaMiddleware),
      getDevtools()
    )
  )

  store.runSaga = sagaMiddleware.run
  store.close = () => store.dispatch(END)

  if (module.hot) {
    module.hot.accept('./reducer', () => {
      store.replaceReducer(require('./reducer').default)
    })
  }

  return store
}

export default configureStore
