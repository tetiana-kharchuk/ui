import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { Link } from 'react-router-dom'
import { forEach, isEmpty, intersectionWith } from 'lodash'

import Details from '../Details/Details'
import MlReactFlow from '../../common/ReactFlow/MlReactFlow'
import TextTooltipTemplate from '../../elements/TooltipTemplate/TextTooltipTemplate'
import Tooltip from '../../common/Tooltip/Tooltip'
import YamlModal from '../../common/YamlModal/YamlModal'
import Table from '../Table/Table'

import { generateContentActionsMenu } from '../../layout/Content/content.util'
import { getLayoutedElements } from '../../common/ReactFlow/mlReactFlow.util'
import { getWorkflowDetailsLink } from './workflow.util'
import { useYaml } from '../../hooks/yaml.hook'
import functionsActions from '../../actions/functions'
import { connect } from 'react-redux'
import { page } from '../JobsPage/jobsData'
import { DETAILS_OVERVIEW_TAB } from '../../constants'

import { ReactComponent as Back } from '../../images/back-arrow.svg'
import { ReactComponent as ListView } from '../../images/listview.svg'
import { ReactComponent as Pipelines } from '../../images/pipelines.svg'
import { ReactComponent as Yaml } from '../../images/yaml.svg'

import './workflow.scss'

const Workflow = ({
  content,
  fetchWorkflow,
  handleCancel,
  handleSelectItem,
  history,
  match,
  pageData,
  refresh,
  refreshJobs,
  selectedFunction,
  selectedJob,
  setLoading,
  setWorkflowsViewMode,
  workflowsViewMode
}) => {
  const [convertedYaml, toggleConvertedYaml] = useYaml('')
  const [itemIsSelected, setItemIsSelected] = useState(false)
  const [jobsContent, setJobsContent] = useState([])
  const [workflow, setWorkflow] = useState({})
  const [workflowJobsIds, setWorkflowJobsIds] = useState([])
  const [elements, setElements] = useState([])

  const graphViewClassNames = classnames(
    'graph-view',
    (selectedJob?.uid || selectedFunction?.hash) && 'with-selected-job'
  )

  const actionsMenu = useMemo(() => {
    return generateContentActionsMenu(pageData.actionsMenu, [
      {
        label: 'View YAML',
        icon: <Yaml />,
        onClick: toggleConvertedYaml
      }
    ])
  }, [pageData.actionsMenu, toggleConvertedYaml])

  useEffect(() => {
    if (!workflow.graph) {
      fetchWorkflow(match.params.workflowId).then(workflow => {
        setWorkflow(workflow)
        setWorkflowJobsIds(
          Object.values(workflow.graph).map(jobData => jobData.run_uid)
        )
      })
    }
  }, [fetchWorkflow, match.params.workflowId, workflow.graph])

  useEffect(() => {
    if (workflowJobsIds.length > 0 && content.length > 0) {
      setJobsContent(
        intersectionWith(
          content,
          workflowJobsIds,
          (contentItem, jobId) => contentItem.uid === jobId
        )
      )
    }
  }, [content, workflowJobsIds])

  useEffect(() => {
    setItemIsSelected(isEmpty(selectedFunction))
  }, [selectedFunction])

  useEffect(() => {
    setItemIsSelected(isEmpty(selectedJob))
  }, [selectedJob])

  useEffect(() => {
    const edges = []
    const nodes = []

    forEach(workflow.graph, job => {
      if (job.type === 'DAG') return

      let nodeItem = {
        id: job.id,
        data: {
          function: job.function,
          label: job.name,
          run_uid: job.run_uid,
          run_type: job.run_type
        },
        className: classnames(
          ((job.run_uid && selectedJob.uid === job.run_uid) ||
            (job.run_type === 'deploy' &&
              job.function.includes(selectedFunction.hash))) &&
            'selected',
          (job.run_uid || (job.run_type === 'deploy' && job.function)) &&
            'selectable'
        ),
        position: { x: 0, y: 0 }
      }

      job.children.forEach(childId => {
        edges.push({
          id: `e.${job.id}.${childId}`,
          source: job.id,
          target: childId,
          type: 'smoothstep',
          animated: false,
          arrowHeadType: 'arrowclosed'
        })
      })

      nodes.push(nodeItem)
    })

    setElements(getLayoutedElements(nodes.concat(edges)))
  }, [selectedFunction.hash, selectedJob.uid, workflow])

  const getCloseDetailsLink = () => {
    return match.url
      .split('/')
      .splice(0, match.path.split('/').indexOf(':workflowId') + 1)
      .join('/')
  }

  return (
    <div className="workflow-container">
      <div className="workflow-header">
        <div className="link-back">
          <Link
            to={`/projects/${match.params.projectName}/jobs/${match.params.pageTab}`}
            className="link-back__icon"
          >
            <Tooltip template={<TextTooltipTemplate text="Back" />}>
              <Back />
            </Tooltip>
          </Link>
          <div className="link-back__title">
            <Tooltip
              template={<TextTooltipTemplate text={workflow?.run?.name} />}
            >
              {workflow?.run?.name}
            </Tooltip>
          </div>
        </div>
        <div className="actions">
          <Tooltip
            template={
              <TextTooltipTemplate
                text={
                  workflowsViewMode === 'graph'
                    ? 'Switch to list view'
                    : 'Switch to graph view'
                }
              />
            }
          >
            <button
              className="toggle-view-btn"
              onClick={() =>
                setWorkflowsViewMode(
                  workflowsViewMode === 'graph' ? 'list' : 'graph'
                )
              }
            >
              {workflowsViewMode === 'graph' ? <ListView /> : <Pipelines />}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="workflow-content">
        {workflowsViewMode === 'graph' ? (
          <>
            <div className={graphViewClassNames}>
              <MlReactFlow
                elements={elements}
                alignTriggerItem={itemIsSelected}
                onElementClick={(event, element) => {
                  if (element?.data.run_uid) {
                    history.push(
                      getWorkflowDetailsLink(
                        match.params,
                        null,
                        element.data.run_uid
                      )
                    )
                  } else if (
                    element?.data.run_type === 'deploy' &&
                    element?.data.function
                  ) {
                    const funcName = element.data.function.match(/\/(.*?)@/i)[1]
                    const funcHash = element.data.function.replace(/.*@/g, '')
                    const link = `/projects/${
                      match.params.projectName
                    }/${page.toLowerCase()}/${match.params.pageTab}/workflow/${
                      match.params.workflowId
                    }/${funcName}/${funcHash}/${DETAILS_OVERVIEW_TAB}`

                    history.push(link)
                  }
                }}
              />
              {(!isEmpty(selectedJob) || !isEmpty(selectedFunction)) && (
                <Details
                  actionsMenu={actionsMenu}
                  detailsMenu={pageData.details.menu}
                  getCloseDetailsLink={getCloseDetailsLink}
                  handleCancel={handleCancel}
                  match={match}
                  pageData={pageData}
                  retryRequest={refreshJobs}
                  selectedItem={
                    !isEmpty(selectedFunction) ? selectedFunction : selectedJob
                  }
                />
              )}
            </div>
          </>
        ) : (
          <Table
            actionsMenu={actionsMenu}
            content={jobsContent}
            getCloseDetailsLink={getCloseDetailsLink}
            handleCancel={handleCancel}
            handleSelectItem={handleSelectItem}
            match={match}
            pageData={pageData}
            retryRequest={refresh}
            selectedItem={selectedJob}
            setLoading={setLoading}
          />
        )}

        {convertedYaml.length > 0 && (
          <YamlModal
            convertedYaml={convertedYaml}
            toggleConvertToYaml={toggleConvertedYaml}
          />
        )}
      </div>
    </div>
  )
}

Workflow.defaultProps = {
  selectedFunction: {},
  selectedJob: {},
  setLoading: null
}

Workflow.propTypes = {
  content: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  fetchWorkflow: PropTypes.func.isRequired,
  handleCancel: PropTypes.func.isRequired,
  handleSelectItem: PropTypes.func.isRequired,
  history: PropTypes.shape({}).isRequired,
  match: PropTypes.shape({}).isRequired,
  pageData: PropTypes.shape({}).isRequired,
  refresh: PropTypes.func.isRequired,
  refreshJobs: PropTypes.func.isRequired,
  selectedFunction: PropTypes.shape({}),
  selectedJob: PropTypes.shape({}),
  setLoading: PropTypes.func,
  setWorkflowsViewMode: PropTypes.func.isRequired,
  workflowsViewMode: PropTypes.string.isRequired
}

export default connect(null, { ...functionsActions })(React.memo(Workflow))