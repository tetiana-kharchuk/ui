/*
Copyright 2019 Iguazio Systems Ltd.

Licensed under the Apache License, Version 2.0 (the "License") with
an addition restriction as set forth herein. You may not use this
file except in compliance with the License. You may obtain a copy of
the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing
permissions and limitations under the License.

In addition, you may not use the software for any purposes that are
illegal under applicable law, and the grant of the foregoing license
under the Apache 2.0 license is conditioned upon your compliance with
such restriction.
*/
import React from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { createForm } from 'final-form'
import { Form } from 'react-final-form'
import arrayMutators from 'final-form-arrays'
import { v4 as uuidv4 } from 'uuid'

import { Button, Modal, FormChipCell, FormInput, FormTextarea } from 'igz-controls/components'
import TargetPath from '../../common/TargetPath/TargetPath'

import { getChipOptions } from '../../utils/getChipOptions'
import { convertChipsData } from '../../utils/convertChipsData'
import { getValidationRules } from 'igz-controls/utils/validation.util'
import { setFieldState } from 'igz-controls/utils/form.util'
import { useModalBlockHistory } from '../../hooks/useModalBlockHistory.hook'
import { MODAL_SM, SECONDARY_BUTTON, TERTIARY_BUTTON } from 'igz-controls/constants'
import notificationActions from '../../actions/notification'
import { useMode } from '../../hooks/mode.hook'
import artifactApi from '../../api/artifacts-api'

import './registerModelPopUp.scss'

function RegisterModelPopUp({ actions, isOpen, onResolve, projectName, refresh }) {
  const { isDemoMode } = useMode()
  const initialValues = {
    metadata: {
      description: undefined,
      labels: [],
      key: undefined
    },
    spec: {
      target_path: isDemoMode
        ? {
            fieldInfo: {
              pathType: ''
            },
            path: ''
          }
        : undefined
    }
  }
  const formRef = React.useRef(
    createForm({
      initialValues,
      mutators: { ...arrayMutators, setFieldState },
      onSubmit: () => {}
    })
  )
  const location = useLocation()
  const { handleCloseModal, resolveModal } = useModalBlockHistory(onResolve, formRef.current)
  const filtersStore = useSelector(store => store.filtersStore)
  const dispatch = useDispatch()

  const registerModel = values => {
    const uid = uuidv4()

    const data = {
      kind: 'model',
      metadata: {
        ...values.metadata,
        labels: convertChipsData(values.metadata.labels),
        project: projectName,
        tree: uid
      },
      project: projectName,
      spec: {
        db_key: values.metadata.key,
        producer: {
          kind: 'api',
          uri: window.location.host
        },
        target_path: isDemoMode ? values.spec.target_path.path : values.spec.target_path
      },
      status: {},
      uid
    }

    if (values.spec.target_path?.path?.includes('/') || values.spec.target_path?.includes('/')) {
      const path = isDemoMode
        ? values.spec.target_path.path.split(/([^/]*)$/)
        : values.spec.target_path.split(/([^/]*)$/)

      data.spec.target_path = path[0]
      data.spec.model_file = path[1]
    }

    return artifactApi
      .registerArtifact(projectName, data)
      .then(response => {
        resolveModal()
        refresh(filtersStore)
        dispatch(
          notificationActions.setNotification({
            status: response.status,
            id: Math.random(),
            message: 'Model initiated successfully'
          })
        )
      })
      .catch(() => {
        resolveModal()
        dispatch(
          notificationActions.setNotification({
            status: 400,
            id: Math.random(),
            message: 'Model failed to initiate',
            retry: registerModel
          })
        )
      })
  }

  const getModalActions = formState => {
    const defaultActions = actions
      ? actions(formState, handleCloseModal)
      : [
          {
            label: 'Cancel',
            onClick: () => handleCloseModal(),
            variant: TERTIARY_BUTTON
          },
          {
            disabled: formState.submitting || (formState.invalid && formState.submitFailed),
            label: 'Register',
            onClick: formState.handleSubmit,
            variant: SECONDARY_BUTTON
          }
        ]
    return defaultActions.map(action => <Button {...action} />)
  }

  return (
    <Form form={formRef.current} onSubmit={registerModel}>
      {formState => {
        return (
          <Modal
            actions={getModalActions(formState)}
            className="register-model form"
            location={location}
            onClose={handleCloseModal}
            show={isOpen}
            size={MODAL_SM}
            title="Register model"
          >
            <div className="form-row">
              <FormInput
                label="Name"
                name="metadata.key"
                required
                tip="Artifacts names in the same project must be unique."
                validationRules={getValidationRules('artifact.name')}
              />
            </div>
            <div className="form-row">
              <FormTextarea name="metadata.description" label="Description" maxLength={500} />
            </div>
            <div className="form-row">
              {isDemoMode ? (
                <TargetPath
                  formState={formState}
                  formStateFieldInfo="spec.target_path.fieldInfo"
                  label="Target Path"
                  name="spec.target_path.path"
                  required
                  selectPlaceholder="Path Scheme"
                  setFieldState={formState.form.mutators.setFieldState}
                />
              ) : (
                <FormInput name="spec.target_path" label="Target path" required />
              )}
            </div>
            <div className="form-row">
              <FormChipCell
                chipOptions={getChipOptions('metrics')}
                formState={formState}
                initialValues={initialValues}
                isEditMode
                label="labels"
                name="metadata.labels"
                shortChips
                visibleChipsMaxLength="2"
                validationRules={{
                  key: getValidationRules('common.tag'),
                  value: getValidationRules('common.tag')
                }}
              />
            </div>
          </Modal>
        )
      }}
    </Form>
  )
}

RegisterModelPopUp.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  projectName: PropTypes.string.isRequired,
  refresh: PropTypes.func.isRequired
}

export default RegisterModelPopUp