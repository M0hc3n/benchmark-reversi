import Portal from './Portal'
import PropTypes from 'prop-types'
import React from 'react'
import cx from 'classnames'

export function Confirm ({ open, children, onConfirm, onCancel }) {
  return (
    <Portal target='dialog-root'>
      <div className={cx('modal', { 'is-active': open })}>
        <div className='modal-background' />
        <div className='modal-content'>
          <div className='box'>
            <p className='title is-2'>{children}</p>
            <div className='field is-grouped'>
              <p className='control'>
                <button className='button is-primary' onClick={onConfirm}>
                  Yes
                </button>
              </p>
              <p className='control'>
                <button className='button' onClick={onCancel}>
                  No
                </button>
              </p>
            </div>
          </div>
        </div>
        <button className='modal-close' onClick={onCancel} />
      </div>
    </Portal>
  )
}

Confirm.propTypes = {
  open: PropTypes.any.isRequired,
  children: PropTypes.node,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func
}
